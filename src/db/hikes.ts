import { uuidv7 } from './ids';
import { addTrackPoints, type NewTrackPoint } from './track-points';
import type { Db } from './types';

export type HikeStatus = 'recording' | 'paused' | 'finished';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';
/** Who can see a hike and its post, as in the API. 'private' is "Only me". */
export type HikeVisibility = 'private' | 'followers' | 'public';
/** Recorded with this app's GPS, or imported from a GPX file (as in the API). */
export type HikeSource = 'recorded' | 'imported';

/** A hike as stored on the phone. Times are epoch milliseconds. */
export type Hike = {
  id: string;
  title: string | null;
  status: HikeStatus;
  startedAt: number;
  endedAt: number | null;
  syncStatus: SyncStatus;
  clientUpdatedAt: number;
  visibility: HikeVisibility;
  distanceM: number;
  elevationGainM: number;
  movingTimeS: number;
  source: HikeSource;
  /** The app's copy of an imported GPX file, until the server has it. */
  importFileUri: string | null;
};

type HikeRow = {
  id: string;
  title: string | null;
  status: HikeStatus;
  started_at: number;
  ended_at: number | null;
  sync_status: SyncStatus;
  client_updated_at: number;
  visibility: HikeVisibility;
  distance_m: number;
  elevation_gain_m: number;
  moving_time_s: number;
  source: HikeSource;
  import_file_uri: string | null;
};

function toHike(row: HikeRow): Hike {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    syncStatus: row.sync_status,
    clientUpdatedAt: row.client_updated_at,
    visibility: row.visibility,
    distanceM: row.distance_m,
    elevationGainM: row.elevation_gain_m,
    movingTimeS: row.moving_time_s,
    source: row.source,
    importFileUri: row.import_file_uri,
  };
}

/** A hike read from a GPX file, ready to save (see features/gpx). */
export type ImportedHikeInput = {
  id: string;
  title: string | null;
  startedAt: number;
  endedAt: number;
  fileUri: string;
  stats: Pick<Hike, 'distanceM' | 'elevationGainM' | 'movingTimeS'>;
  points: readonly NewTrackPoint[];
};

/**
 * Saves an imported hike, finished, with all its points, in one transaction:
 * a half-saved import would show a broken route. It starts 'pending', so the
 * outbox uploads its file like any finished hike.
 */
export async function createImportedHike(db: Db, input: ImportedHikeInput): Promise<Hike> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO hikes
         (id, title, status, started_at, ended_at, client_updated_at, source, import_file_uri,
          distance_m, elevation_gain_m, moving_time_s)
       VALUES (?, ?, 'finished', ?, ?, ?, 'imported', ?, ?, ?, ?)`,
      [
        input.id,
        input.title,
        input.startedAt,
        input.endedAt,
        input.endedAt,
        input.fileUri,
        input.stats.distanceM,
        input.stats.elevationGainM,
        input.stats.movingTimeS,
      ],
    );
    await addTrackPoints(db, input.id, input.points);
  });
  const hike = await getHike(db, input.id);
  if (!hike) throw new Error(`Hike ${input.id} was not saved`);
  return hike;
}

/**
 * A hike on this phone that overlaps the time from `startedAt` to `endedAt`,
 * or null. The server refuses an import that overlaps another hike
 * (HIKE_OVERLAPS: likely the same hike, recorded here and exported from a
 * watch), so the phone checks first and says so right away.
 */
export async function findOverlappingHike(
  db: Db,
  startedAt: number,
  endedAt: number,
): Promise<{ id: string; title: string | null; startedAt: number } | null> {
  const row = await db.getFirstAsync<{ id: string; title: string | null; started_at: number }>(
    `SELECT id, title, started_at FROM hikes
     WHERE started_at <= ? AND COALESCE(ended_at, started_at) >= ?
     ORDER BY started_at LIMIT 1`,
    [endedAt, startedAt],
  );
  return row ? { id: row.id, title: row.title, startedAt: row.started_at } : null;
}

/** Forgets an imported hike's file once the server has it (the file itself is deleted separately). */
export async function clearImportFile(db: Db, id: string): Promise<void> {
  await db.runAsync('UPDATE hikes SET import_file_uri = NULL WHERE id = ?', [id]);
}

/** Starts a new hike in the "recording" state. Works offline: the id is made here. */
export async function createHike(db: Db, startedAt: number = Date.now()): Promise<Hike> {
  const id = uuidv7(startedAt);
  await db.runAsync('INSERT INTO hikes (id, started_at, client_updated_at) VALUES (?, ?, ?)', [
    id,
    startedAt,
    startedAt,
  ]);
  const hike = await getHike(db, id);
  if (!hike) throw new Error(`Hike ${id} was not saved`);
  return hike;
}

export async function getHike(db: Db, id: string): Promise<Hike | null> {
  const row = await db.getFirstAsync<HikeRow>('SELECT * FROM hikes WHERE id = ?', [id]);
  return row ? toHike(row) : null;
}

/** A hike in the history list: the hike plus how many GPS points it has. */
export type HistoryHike = Hike & { pointCount: number };

/**
 * Every finished hike on this phone, newest first, for the hike history.
 * Hikes still being recorded or paused aren't history yet: they show on
 * the Record screen.
 *
 * Hikes without a single GPS point are left out (e.g. finished before the
 * first fix arrived). They have no route or stats to show, and the outbox
 * never uploads them, so they'd say "Pending" forever.
 */
export async function listFinishedHikes(db: Db): Promise<HistoryHike[]> {
  // The count reads the (hike_id, seq) primary key, so it doesn't scan the points.
  const rows = await db.getAllAsync<HikeRow & { point_count: number }>(
    `SELECT h.*, (SELECT COUNT(*) FROM track_points p WHERE p.hike_id = h.id) AS point_count
     FROM hikes h
     WHERE h.status = 'finished'
       AND EXISTS (SELECT 1 FROM track_points p WHERE p.hike_id = h.id)
     ORDER BY h.started_at DESC`,
  );
  return rows.map((row) => ({ ...toHike(row), pointCount: row.point_count }));
}

/**
 * The hike GPS points should go to: the newest one that is recording. Null
 * while paused or finished, so late fixes from the location task are dropped.
 */
export async function getRecordingHike(
  db: Db,
): Promise<{ id: string; startedAt: number } | null> {
  const row = await db.getFirstAsync<{ id: string; started_at: number }>(
    "SELECT id, started_at FROM hikes WHERE status = 'recording' ORDER BY started_at DESC LIMIT 1",
  );
  return row ? { id: row.id, startedAt: row.started_at } : null;
}

/**
 * Hikes that were never finished (recording or paused), newest first. Normally
 * at most one; more only if the app was killed mid-hike in the past.
 */
export async function getUnfinishedHikes(
  db: Db,
): Promise<{ id: string; status: 'recording' | 'paused'; startedAt: number }[]> {
  const rows = await db.getAllAsync<{
    id: string;
    status: 'recording' | 'paused';
    started_at: number;
  }>(
    `SELECT id, status, started_at FROM hikes
     WHERE status IN ('recording', 'paused') ORDER BY started_at DESC`,
  );
  return rows.map((row) => ({ id: row.id, status: row.status, startedAt: row.started_at }));
}

/**
 * Saves the live stats computed on the phone. Doesn't change
 * client_updated_at: stats follow from the points, which sync uploads anyway.
 */
export async function setHikeStats(
  db: Db,
  id: string,
  stats: Pick<Hike, 'distanceM' | 'elevationGainM' | 'movingTimeS'>,
): Promise<void> {
  await db.runAsync(
    'UPDATE hikes SET distance_m = ?, elevation_gain_m = ?, moving_time_s = ? WHERE id = ?',
    [stats.distanceM, stats.elevationGainM, stats.movingTimeS, id],
  );
}

/**
 * Names the hike (null for no name). It's an edit by the hiker, so
 * client_updated_at moves too: the server keeps the newer of two versions.
 */
export async function setHikeTitle(
  db: Db,
  id: string,
  title: string | null,
  now: number = Date.now(),
): Promise<void> {
  const result = await db.runAsync(
    'UPDATE hikes SET title = ?, client_updated_at = ? WHERE id = ?',
    [title, now, id],
  );
  if (result.changes === 0) throw new Error(`Hike ${id} not found`);
}

/**
 * Records how the hike's upload is going: 'syncing' while it uploads,
 * 'synced' once the server has all of it, back to 'pending' if it failed and
 * will be retried. Doesn't change client_updated_at (not an edit by the user).
 */
export async function setSyncStatus(db: Db, id: string, status: SyncStatus): Promise<void> {
  await db.runAsync('UPDATE hikes SET sync_status = ? WHERE id = ?', [status, id]);
}

/**
 * Finished hikes the upload gave up on (the server rejected them). They are
 * no longer in the outbox, so the sync status indicator counts them here.
 */
export async function countFailedHikes(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM hikes WHERE status = 'finished' AND sync_status = 'failed'",
  );
  return row?.n ?? 0;
}

/**
 * Puts hikes the upload gave up on back to 'pending', so they can be queued
 * again. Used when the hiker taps Retry. Returns how many were reset.
 */
export async function resetFailedHikes(db: Db): Promise<number> {
  const result = await db.runAsync(
    "UPDATE hikes SET sync_status = 'pending' WHERE sync_status = 'failed'",
  );
  return result.changes;
}

/** Removes a hike and its points, e.g. one that never got GPS started. */
export async function deleteHike(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM hikes WHERE id = ?', [id]);
}

/**
 * Saves a recorder state change. Finishing also records when the hike ended.
 * Which changes are allowed is the recorder's job (see recorder-store.ts).
 */
export async function setHikeStatus(
  db: Db,
  id: string,
  status: HikeStatus,
  now: number = Date.now(),
): Promise<void> {
  const result = await db.runAsync(
    `UPDATE hikes
     SET status = ?,
         ended_at = CASE WHEN ? = 'finished' THEN ? ELSE ended_at END,
         client_updated_at = ?
     WHERE id = ?`,
    [status, status, now, now, id],
  );
  if (result.changes === 0) throw new Error(`Hike ${id} not found`);
}
