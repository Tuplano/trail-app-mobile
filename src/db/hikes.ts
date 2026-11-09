import { uuidv7 } from './ids';
import type { Db } from './types';

export type HikeStatus = 'recording' | 'paused' | 'finished';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

/** A hike as stored on the phone. Times are epoch milliseconds. */
export type Hike = {
  id: string;
  title: string | null;
  status: HikeStatus;
  startedAt: number;
  endedAt: number | null;
  syncStatus: SyncStatus;
  clientUpdatedAt: number;
  distanceM: number;
  elevationGainM: number;
  movingTimeS: number;
};

type HikeRow = {
  id: string;
  title: string | null;
  status: HikeStatus;
  started_at: number;
  ended_at: number | null;
  sync_status: SyncStatus;
  client_updated_at: number;
  distance_m: number;
  elevation_gain_m: number;
  moving_time_s: number;
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
    distanceM: row.distance_m,
    elevationGainM: row.elevation_gain_m,
    movingTimeS: row.moving_time_s,
  };
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
