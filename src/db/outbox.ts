import type { Db } from './types';

/**
 * What an outbox item uploads. 'hike' = the hike, its points in chunks, then
 * finish (see the API's /hikes endpoints). Photos and posts join in Stage 5.
 */
export type OutboxKind = 'hike';

/** One thing waiting to be uploaded. Times are epoch milliseconds. */
export type OutboxItem = {
  id: number;
  kind: OutboxKind;
  /** Which one, e.g. the hike's id. */
  entityId: string;
  /** Failed upload attempts so far. */
  attempts: number;
  lastError: string | null;
  /** Don't try before this time (set after a failure, for backing off). */
  nextAttemptAt: number;
  createdAt: number;
};

type OutboxRow = {
  id: number;
  kind: OutboxKind;
  entity_id: string;
  attempts: number;
  last_error: string | null;
  next_attempt_at: number;
  created_at: number;
};

function toItem(row: OutboxRow): OutboxItem {
  return {
    id: row.id,
    kind: row.kind,
    entityId: row.entity_id,
    attempts: row.attempts,
    lastError: row.last_error,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
  };
}

/**
 * Queues something for upload, due at once. Queuing the same thing twice does
 * nothing (the table allows each kind + id once), so callers needn't check,
 * and an item that is backing off after a failure keeps its retry time.
 */
export async function enqueue(
  db: Db,
  kind: OutboxKind,
  entityId: string,
  now: number = Date.now(),
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO outbox (kind, entity_id, next_attempt_at, created_at)
     VALUES (?, ?, ?, ?)`,
    [kind, entityId, now, now],
  );
}

/**
 * Queues every finished hike that still needs uploading: not synced yet and
 * with at least one GPS point (an empty hike has nothing worth sending).
 * Returns how many were newly queued.
 *
 * Run after finishing a hike and when the app opens. The second run catches
 * hikes whose queuing was missed, e.g. the app crashed right after Finish.
 */
export async function enqueueUnsyncedHikes(db: Db, now: number = Date.now()): Promise<number> {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO outbox (kind, entity_id, next_attempt_at, created_at)
     SELECT 'hike', h.id, ?, ?
     FROM hikes h
     WHERE h.status = 'finished'
       AND h.sync_status != 'synced'
       AND EXISTS (SELECT 1 FROM track_points p WHERE p.hike_id = h.id)
     ORDER BY h.started_at`,
    [now, now],
  );
  return result.changes;
}

/** Items whose time has come, oldest due first. Sync works through these. */
export async function getDueItems(
  db: Db,
  now: number = Date.now(),
  limit = 20,
): Promise<OutboxItem[]> {
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE next_attempt_at <= ?
     ORDER BY next_attempt_at, id LIMIT ?`,
    [now, limit],
  );
  return rows.map(toItem);
}

/** Everything still waiting, due or not. For the sync status indicator. */
export async function countPending(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
  return row?.n ?? 0;
}

/** Uploaded: the item leaves the queue. */
export async function markDone(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
}

/**
 * The upload failed: count the attempt, keep the reason, and don't try again
 * before `retryAt`. How long to wait (backoff) is up to the sync code.
 */
export async function markFailed(
  db: Db,
  id: number,
  error: string,
  retryAt: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE outbox
     SET attempts = attempts + 1, last_error = ?, next_attempt_at = ?
     WHERE id = ?`,
    [error, retryAt, id],
  );
}
