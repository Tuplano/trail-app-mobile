import { getDueItems, markDone, markFailed, type OutboxItem, type OutboxKind } from '@/db/outbox';
import type { Db } from '@/db/types';

/** Uploads one outbox item. Throws if the upload failed; the item is then retried. */
export type UploadHandler = (db: Db, item: OutboxItem) => Promise<void>;

/** Which handler uploads each kind. A kind without one stays queued for now. */
export type UploadHandlers = Partial<Record<OutboxKind, UploadHandler>>;

/**
 * How long a failed item waits before it's tried again. A fixed wait for now;
 * task #32 replaces it with a backoff that waits longer after each failure.
 */
export const RETRY_DELAY_MS = 60_000;

const BATCH = 20;

export type OutboxRun = { uploaded: number; failed: number; skipped: number };

/**
 * Works once through the outbox items that are due: each one goes to the
 * handler for its kind; success removes it, failure schedules a retry.
 * One failure doesn't stop the rest (a bad item mustn't block good ones).
 */
export async function processOutbox(
  db: Db,
  handlers: UploadHandlers,
  now: () => number = Date.now,
): Promise<OutboxRun> {
  const run: OutboxRun = { uploaded: 0, failed: 0, skipped: 0 };
  const seen = new Set<number>();

  // Items without a handler stay due, so page past them instead of re-reading them.
  for (;;) {
    const items = (await getDueItems(db, now(), BATCH + seen.size)).filter((i) => !seen.has(i.id));
    if (items.length === 0) return run;

    for (const item of items) {
      seen.add(item.id);
      const upload = handlers[item.kind];
      if (!upload) {
        run.skipped++;
        continue;
      }
      try {
        await upload(db, item);
        await markDone(db, item.id);
        run.uploaded++;
      } catch (error) {
        await markFailed(db, item.id, describe(error), now() + RETRY_DELAY_MS);
        run.failed++;
      }
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
