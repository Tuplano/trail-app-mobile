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
