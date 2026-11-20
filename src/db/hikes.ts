import { uuidv7 } from './ids';
import { addTrackPoints, type NewTrackPoint } from './track-points';
import type { Db } from './types';

export type HikeStatus = 'recording' | 'paused' | 'finished';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';
/** Who can see a hike and its post, as in the API. 'private' is "Only me". */
export type HikeVisibility = 'private' | 'followers' | 'public';
/** Recorded with this app's GPS, or imported from a GPX file (as in the API). */
export type HikeSource = 'recorded' | 'imported';
/** Whose numbers a hike shows: the phone's estimate, or the server's final ones. */
export type StatsSource = 'phone' | 'server';

/** A hike as stored on the phone. Times are epoch milliseconds. */
export type Hike = {
  id: string;
  /** The account it belongs to; null if saved before the app recorded owners. */
  userId: string | null;
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
  /** 'server' once the server's final numbers replaced the phone's estimate. */
  statsSource: StatsSource;
};

type HikeRow = {
  id: string;
  user_id: string | null;
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
  stats_source: StatsSource;
};

function toHike(row: HikeRow): Hike {
  return {
    id: row.id,
    userId: row.user_id,
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
    statsSource: row.stats_source,
  };
}

/** A hike's three numbers, as the server works them out once it has processed it. */
export type ServerStats = Pick<Hike, 'distanceM' | 'elevationGainM' | 'movingTimeS'>;

/**
 * The signed-in account's uploaded hikes still showing the phone's estimate,
 * newest first: the ones to ask the server about. At most `limit`, so one
 * sync run stays short. (The server only answers about its owner's hikes.)
 */
export async function listHikesAwaitingServerStats(
  db: Db,
  userId: string,
  limit = 20,
): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM hikes
     WHERE user_id = ? AND status = 'finished' AND sync_status = 'synced'
       AND stats_source = 'phone'
     ORDER BY started_at DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map((row) => row.id);
}

/**
 * Hikes saved before the app recorded owners (user_id NULL), for
 * claimHikes(). Each with whether it reached the server: only those can be
 * checked there.
 */
export async function listUnownedHikes(
  db: Db,
): Promise<{ id: string; uploaded: boolean }[]> {
  const rows = await db.getAllAsync<{ id: string; sync_status: SyncStatus }>(
    'SELECT id, sync_status FROM hikes WHERE user_id IS NULL ORDER BY started_at',
  );
  return rows.map((row) => ({ id: row.id, uploaded: row.sync_status === 'synced' }));
}

/** Records that these hikes belong to `userId` (only hikes without an owner yet). */
export async function setHikeOwner(db: Db, ids: readonly string[], userId: string): Promise<void> {
  if (ids.length === 0) return;
  await db.runAsync(
    `UPDATE hikes SET user_id = ? WHERE user_id IS NULL AND id IN (${ids.map(() => '?').join(', ')})`,
    [userId, ...ids],
  );
}

/**
 * Saves the server's numbers over the phone's estimate. The phone's numbers
 * aren't kept: the server's are better (map heights, barometer) and the
 * history and detail both show these from now on.
 */
export async function saveServerStats(db: Db, id: string, stats: ServerStats): Promise<void> {
  await db.runAsync(
    `UPDATE hikes
     SET distance_m = ?, elevation_gain_m = ?, moving_time_s = ?, stats_source = 'server'
     WHERE id = ?`,
    [stats.distanceM, stats.elevationGainM, stats.movingTimeS, id],
  );
}

/** A hike read from a GPX file, ready to save (see features/gpx). */
export type ImportedHikeInput = {
  id: string;
  /** The signed-in account importing it. */
  userId: string;
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
         (id, user_id, title, status, started_at, ended_at, client_updated_at, source,
          import_file_uri, distance_m, elevation_gain_m, moving_time_s)
       VALUES (?, ?, ?, 'finished', ?, ?, ?, 'imported', ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
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
 * Every hike id on this phone, whoever it belongs to. Downloading past hikes
 * skips these: the phone's own copy is never replaced by the server's.
 */
export async function listHikeIds(db: Db): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM hikes');
  return new Set(rows.map((row) => row.id));
}

/** A hike downloaded from the server, with its route, ready to save (see sync/download-hikes). */
export type DownloadedHikeInput = {
  id: string;
  userId: string;
  title: string | null;
  source: HikeSource;
  visibility: HikeVisibility;
  startedAt: number;
  endedAt: number;
  clientUpdatedAt: number;
  stats: ServerStats;
  statsSource: StatsSource;
  points: readonly NewTrackPoint[];
};

/**
 * Saves a hike that is already on the server (recorded on another phone, or
 * before a reinstall) so History shows it, offline too. It's saved as
 * uploaded, so nothing sends it back. One transaction, like an import: a
 * half-saved hike would show a broken route.
 */
export async function saveDownloadedHike(db: Db, input: DownloadedHikeInput): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO hikes
         (id, user_id, title, status, started_at, ended_at, client_updated_at, sync_status,
          visibility, source, distance_m, elevation_gain_m, moving_time_s, stats_source)
       VALUES (?, ?, ?, 'finished', ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.title,
        input.startedAt,
        input.endedAt,
        input.clientUpdatedAt,
        input.visibility,
        input.source,
        input.stats.distanceM,
        input.stats.elevationGainM,
        input.stats.movingTimeS,
        input.statsSource,
      ],
    );
    await addTrackPoints(db, input.id, input.points);
  });
}

/**
 * A hike of this account on this phone that overlaps the time from
 * `startedAt` to `endedAt`, or null. The server refuses an import that
 * overlaps another of the hiker's hikes (HIKE_OVERLAPS: likely the same hike,
 * recorded here and exported from a watch), so the phone checks first and
 * says so right away. Other accounts' hikes don't count.
 */
export async function findOverlappingHike(
  db: Db,
  userId: string,
  startedAt: number,
  endedAt: number,
): Promise<{ id: string; title: string | null; startedAt: number } | null> {
  const row = await db.getFirstAsync<{ id: string; title: string | null; started_at: number }>(
    `SELECT id, title, started_at FROM hikes
     WHERE user_id = ? AND started_at <= ? AND COALESCE(ended_at, started_at) >= ?
     ORDER BY started_at LIMIT 1`,
    [userId, endedAt, startedAt],
  );
  return row ? { id: row.id, title: row.title, startedAt: row.started_at } : null;
}

/** Forgets an imported hike's file once the server has it (the file itself is deleted separately). */
export async function clearImportFile(db: Db, id: string): Promise<void> {
  await db.runAsync('UPDATE hikes SET import_file_uri = NULL WHERE id = ?', [id]);
}

/**
 * Starts a new hike for the signed-in account (`userId`) in the "recording"
 * state. Works offline: the id is made here.
 */
export async function createHike(
  db: Db,
  userId: string,
  startedAt: number = Date.now(),
): Promise<Hike> {
  const id = uuidv7(startedAt);
  await db.runAsync(
    'INSERT INTO hikes (id, user_id, started_at, client_updated_at) VALUES (?, ?, ?, ?)',
    [id, userId, startedAt, startedAt],
  );
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
 * The signed-in account's finished hikes on this phone, newest first, for
 * the hike history. Hikes still being recorded or paused aren't history yet:
 * they show on the Record screen. Other accounts' hikes stay on the phone
 * but aren't shown.
 *
 * Hikes without a single GPS point are left out (e.g. finished before the
 * first fix arrived). They have no route or stats to show, and the outbox
 * never uploads them, so they'd say "Pending" forever.
 */
export async function listFinishedHikes(db: Db, userId: string): Promise<HistoryHike[]> {
  // The count reads the (hike_id, seq) primary key, so it doesn't scan the points.
  const rows = await db.getAllAsync<HikeRow & { point_count: number }>(
    `SELECT h.*, (SELECT COUNT(*) FROM track_points p WHERE p.hike_id = h.id) AS point_count
     FROM hikes h
     WHERE h.user_id = ? AND h.status = 'finished'
       AND EXISTS (SELECT 1 FROM track_points p WHERE p.hike_id = h.id)
     ORDER BY h.started_at DESC`,
    [userId],
  );
  return rows.map((row) => ({ ...toHike(row), pointCount: row.point_count }));
}

/**
 * The hike GPS points should go to: the newest one that is recording. Null
 * while paused or finished, so late fixes from the location task are dropped.
 * Not limited to one account: the location task runs without a screen, and
 * there is only ever one hike recording (signing out is blocked meanwhile).
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
 * The account's hikes that were never finished (recording or paused), newest
 * first. Normally at most one; more only if the app was killed mid-hike in
 * the past.
 */
export async function getUnfinishedHikes(
  db: Db,
  userId: string,
): Promise<{ id: string; status: 'recording' | 'paused'; startedAt: number }[]> {
  const rows = await db.getAllAsync<{
    id: string;
    status: 'recording' | 'paused';
    started_at: number;
  }>(
    `SELECT id, status, started_at FROM hikes
     WHERE user_id = ? AND status IN ('recording', 'paused') ORDER BY started_at DESC`,
    [userId],
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
 * The account's finished hikes the upload gave up on (the server rejected
 * them). They are no longer in the outbox, so the sync status indicator
 * counts them here.
 */
export async function countFailedHikes(db: Db, userId: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM hikes
     WHERE user_id = ? AND status = 'finished' AND sync_status = 'failed'`,
    [userId],
  );
  return row?.n ?? 0;
}

/**
 * Puts the account's hikes the upload gave up on back to 'pending', so they
 * can be queued again. Used when the hiker taps Retry. Returns how many.
 */
export async function resetFailedHikes(db: Db, userId: string): Promise<number> {
  const result = await db.runAsync(
    "UPDATE hikes SET sync_status = 'pending' WHERE user_id = ? AND sync_status = 'failed'",
    [userId],
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
