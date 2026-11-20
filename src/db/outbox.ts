import type { Db } from './types';

/**
 * What an outbox item uploads. 'hike' = the hike, its points in chunks, then
 * finish (see the API's /hikes endpoints). 'post' = a shared hike: its
 * visibility, its photos, then the post (see sync/upload-post.ts).
 */
export type OutboxKind = 'hike' | 'post';

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
 * "This outbox row belongs to the account given as the next `?` parameter":
 * a 'hike' item's hike, or a 'post' item's post's hike, has that owner. The
 * owner lives on the hike only, so it can't disagree between tables. Other
 * accounts' items stay queued, untouched, until their owner signs in again.
 */
export const OWNED_BY = `EXISTS (
  SELECT 1 FROM hikes h
  WHERE h.user_id = ?
    AND h.id = CASE outbox.kind
      WHEN 'hike' THEN outbox.entity_id
      ELSE (SELECT p.hike_id FROM posts p WHERE p.id = outbox.entity_id)
    END
)`;

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
 * Queues every finished hike of the account that still needs uploading: not
 * uploaded yet ('pending', or 'syncing' if the app stopped mid-upload), not
 * given up on ('failed'), and with at least one GPS point (an empty hike has
 * nothing worth sending). Returns how many were newly queued.
 *
 * Run after finishing a hike and when the app opens. The second run catches
 * hikes whose queuing was missed, e.g. the app crashed right after Finish.
 */
export async function enqueueUnsyncedHikes(
  db: Db,
  userId: string,
  now: number = Date.now(),
): Promise<number> {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO outbox (kind, entity_id, next_attempt_at, created_at)
     SELECT 'hike', h.id, ?, ?
     FROM hikes h
     WHERE h.user_id = ?
       AND h.status = 'finished'
       AND h.sync_status IN ('pending', 'syncing')
       AND EXISTS (SELECT 1 FROM track_points p WHERE p.hike_id = h.id)
     ORDER BY h.started_at`,
    [now, now, userId],
  );
  return result.changes;
}

/**
 * The account's items whose time has come, oldest due first. Sync works
 * through these, signed in as that account, so nothing of another account is
 * ever uploaded to it.
 */
export async function getDueItems(
  db: Db,
  userId: string,
  now: number = Date.now(),
  limit = 20,
): Promise<OutboxItem[]> {
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE next_attempt_at <= ? AND ${OWNED_BY}
     ORDER BY next_attempt_at, id LIMIT ?`,
    [now, userId, limit],
  );
  return rows.map(toItem);
}

/** When the account's soonest waiting item is next due, or null if it has none. */
export async function getNextAttemptAt(db: Db, userId: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ next: number | null }>(
    `SELECT MIN(next_attempt_at) AS next FROM outbox WHERE ${OWNED_BY}`,
    [userId],
  );
  return row?.next ?? null;
}

/** Everything of the account still waiting, due or not. */
export async function countPending(db: Db, userId: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM outbox WHERE ${OWNED_BY}`,
    [userId],
  );
  return row?.n ?? 0;
}

/**
 * How many items of one kind are waiting, and how many of those are backing
 * off after a failed try (not due again until later). For the sync status
 * indicator: "waiting" alone means "about to upload"; backing off means the
 * last try didn't work.
 */
export async function countWaiting(
  db: Db,
  userId: string,
  kind: OutboxKind,
  now: number = Date.now(),
): Promise<{ waiting: number; backingOff: number }> {
  const row = await db.getFirstAsync<{ waiting: number; backing_off: number }>(
    `SELECT COUNT(*) AS waiting,
            COALESCE(SUM(attempts > 0 AND next_attempt_at > ?), 0) AS backing_off
     FROM outbox WHERE kind = ? AND ${OWNED_BY}`,
    [now, kind, userId],
  );
  return { waiting: row?.waiting ?? 0, backingOff: row?.backing_off ?? 0 };
}

/**
 * Makes every waiting item of the account due now, cutting short any backoff
 * wait. For the Retry button: the hiker asked to try again, so don't make
 * them wait up to an hour. The attempt count is kept, so if it fails again
 * the next wait is as long as it would have been.
 */
export async function makeAllDue(db: Db, userId: string, now: number = Date.now()): Promise<void> {
  await db.runAsync(
    `UPDATE outbox SET next_attempt_at = ? WHERE next_attempt_at > ? AND ${OWNED_BY}`,
    [now, now, userId],
  );
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
