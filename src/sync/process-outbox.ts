import { getDueItems, markDone, markFailed, type OutboxItem, type OutboxKind } from '@/db/outbox';
import type { Db } from '@/db/types';

import { GiveUpError, NotYetError, retryDelayMs } from './retry';

/**
 * Uploads one outbox item. Throws if the upload failed: a GiveUpError when
 * retrying can't help (the item is dropped), a NotYetError when it must wait
 * (it stays as it is), anything else to retry later.
 */
export type UploadHandler = (db: Db, item: OutboxItem) => Promise<void>;

/** Which handler uploads each kind. A kind without one stays queued for now. */
export type UploadHandlers = Partial<Record<OutboxKind, UploadHandler>>;

const BATCH = 20;

/** What a run did. `skipped`: left in the queue as it was (no handler yet, or not yet). */
export type OutboxRun = { uploaded: number; failed: number; gaveUp: number; skipped: number };

/**
 * Works once through the outbox items that are due: each one goes to the
 * handler for its kind. Success removes it; a failure schedules a retry,
 * waiting longer after each failure (see retryDelayMs); giving up removes it.
 * One failure doesn't stop the rest (a bad item mustn't block good ones).
 */
export async function processOutbox(
  db: Db,
  handlers: UploadHandlers,
  now: () => number = Date.now,
): Promise<OutboxRun> {
  const run: OutboxRun = { uploaded: 0, failed: 0, gaveUp: 0, skipped: 0 };
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
        if (error instanceof NotYetError) {
          run.skipped++;
          continue;
        }
        if (error instanceof GiveUpError) {
          console.warn(`Gave up uploading ${item.kind} ${item.entityId}`, error.reason);
          await markDone(db, item.id);
          run.gaveUp++;
        } else {
          const retryAt = now() + retryDelayMs(item.attempts);
          await markFailed(db, item.id, describe(error), retryAt);
          run.failed++;
        }
      }
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
