import { prepareDatabase } from '@/db/migrations';
import { countPending, enqueue, getDueItems, type OutboxItem } from '@/db/outbox';
import { createTestDb } from '@/db/__tests__/test-db';
import type { Db } from '@/db/types';

import { processOutbox } from '../process-outbox';
import { GiveUpError, NotYetError, retryDelayMs } from '../retry';

/** The signed-in account in these tests: hikes and posts belong to an account. */
const USER = 'user-1';

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

/**
 * Queues the hike `id` of the signed-in account. Sync only works through the
 * account's own items, so each needs a hike row (bare is enough).
 */
async function enqueueHike(db: Db, id: string, at: number) {
  await db.runAsync(
    'INSERT OR IGNORE INTO hikes (id, user_id, started_at, client_updated_at) VALUES (?, ?, 0, 0)',
    [id, USER],
  );
  await enqueue(db, 'hike', id, at);
}

const clock = (t: number) => () => t;
const nothing = { uploaded: 0, failed: 0, gaveUp: 0, skipped: 0 };

describe('processOutbox', () => {
  it('uploads due items and removes them from the queue', async () => {
    const db = await freshDb();
    await enqueueHike(db, 'a', 1000);
    await enqueueHike(db, 'b', 1000);
    const upload = jest.fn(async (_db: Db, _item: OutboxItem) => {});

    const run = await processOutbox(db, USER, { hike: upload }, clock(2000));

    expect(run).toEqual({ ...nothing, uploaded: 2 });
    expect(upload.mock.calls.map(([, item]) => item.entityId)).toEqual(['a', 'b']);
    expect(await countPending(db, USER)).toBe(0);
  });

  it("retries a failed item later, and doesn't let it block the others", async () => {
    const db = await freshDb();
    await enqueueHike(db, 'bad', 1000);
    await enqueueHike(db, 'good', 1000);
    const upload = jest.fn(async (_db: Db, item: OutboxItem) => {
      if (item.entityId === 'bad') throw new Error('Server error 500');
    });

    const run = await processOutbox(db, USER, { hike: upload }, clock(2000));

    expect(run).toEqual({ ...nothing, uploaded: 1, failed: 1 });
    expect(await getDueItems(db, USER, 2000)).toEqual([]); // waiting to retry
    expect(await getDueItems(db, USER, 2000 + retryDelayMs(0))).toEqual([
      expect.objectContaining({ entityId: 'bad', attempts: 1, lastError: 'Server error 500' }),
    ]);
  });

  it('waits longer after each failure', async () => {
    const db = await freshDb();
    await enqueueHike(db, 'flaky', 0);
    const upload = jest.fn(async () => {
      throw new Error('Server error 503');
    });

    let t = 0;
    const waits: number[] = [];
    for (let i = 0; i < 4; i++) {
      await processOutbox(db, USER, { hike: upload }, clock(t));
      const [next] = await getDueItems(db, USER, Number.MAX_SAFE_INTEGER);
      waits.push((next.nextAttemptAt - t) / 60_000);
      t = next.nextAttemptAt;
    }
    expect(waits).toEqual([1, 2, 4, 8]); // minutes
  });

  it('drops an item the handler gives up on', async () => {
    const db = await freshDb();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await enqueueHike(db, 'not-mine', 1000);
    const upload = jest.fn(async () => {
      throw new GiveUpError(new Error('HIKE_NOT_FOUND'));
    });

    expect(await processOutbox(db, USER, { hike: upload }, clock(2000))).toEqual({
      ...nothing,
      gaveUp: 1,
    });
    expect(await countPending(db, USER)).toBe(0);
  });

  it('leaves items no handler can upload yet in the queue', async () => {
    const db = await freshDb();
    await enqueueHike(db, 'a', 1000);

    expect(await processOutbox(db, USER, {}, clock(2000))).toEqual({ ...nothing, skipped: 1 });
    expect(await countPending(db, USER)).toBe(1);
  });

  it('leaves an item that must wait as it was: no attempt counted, no backoff', async () => {
    const db = await freshDb();
    await enqueueHike(db, 'h1', 0); // the post's hike, already uploaded
    await db.runAsync("DELETE FROM outbox");
    await db.runAsync("INSERT INTO posts (id, hike_id, created_at) VALUES ('p1', 'h1', 0)");
    await enqueue(db, 'post', 'p1', 1000);
    const upload = jest.fn(async () => {
      throw new NotYetError('Waiting for Wi-Fi');
    });

    expect(await processOutbox(db, USER, { post: upload }, clock(2000))).toEqual({
      ...nothing,
      skipped: 1,
    });
    // Still due at once, so the next run tries again.
    expect(await getDueItems(db, USER, 2000)).toEqual([
      expect.objectContaining({
        entityId: 'p1',
        attempts: 0,
        nextAttemptAt: 1000,
        lastError: null,
      }),
    ]);
  });

  it('skips items that are not due yet', async () => {
    const db = await freshDb();
    await enqueueHike(db, 'later', 5000);
    const upload = jest.fn(async () => {});

    expect(await processOutbox(db, USER, { hike: upload }, clock(2000))).toEqual(nothing);
    expect(upload).not.toHaveBeenCalled();
  });

  it('gets through more items than one batch', async () => {
    const db = await freshDb();
    for (let i = 0; i < 45; i++) await enqueueHike(db, `h${i}`, 1000);

    const run = await processOutbox(db, USER, {}, clock(2000));
    expect(run.skipped).toBe(45);
  });
});
