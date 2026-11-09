import { prepareDatabase } from '@/db/migrations';
import { countPending, enqueue, getDueItems, type OutboxItem } from '@/db/outbox';
import { createTestDb } from '@/db/__tests__/test-db';
import type { Db } from '@/db/types';

import { processOutbox, RETRY_DELAY_MS } from '../process-outbox';

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

const clock = (t: number) => () => t;

describe('processOutbox', () => {
  it('uploads due items and removes them from the queue', async () => {
    const db = await freshDb();
    await enqueue(db, 'hike', 'a', 1000);
    await enqueue(db, 'hike', 'b', 1000);
    const upload = jest.fn(async (_db: Db, _item: OutboxItem) => {});

    const run = await processOutbox(db, { hike: upload }, clock(2000));

    expect(run).toEqual({ uploaded: 2, failed: 0, skipped: 0 });
    expect(upload.mock.calls.map(([, item]) => item.entityId)).toEqual(['a', 'b']);
    expect(await countPending(db)).toBe(0);
  });

  it("retries a failed item later, and doesn't let it block the others", async () => {
    const db = await freshDb();
    await enqueue(db, 'hike', 'bad', 1000);
    await enqueue(db, 'hike', 'good', 1000);
    const upload = jest.fn(async (_db: unknown, item: { entityId: string }) => {
      if (item.entityId === 'bad') throw new Error('Server error 500');
    });

    const run = await processOutbox(db, { hike: upload }, clock(2000));

    expect(run).toEqual({ uploaded: 1, failed: 1, skipped: 0 });
    expect(await getDueItems(db, 2000)).toEqual([]); // waiting to retry
    expect(await getDueItems(db, 2000 + RETRY_DELAY_MS)).toEqual([
      expect.objectContaining({ entityId: 'bad', attempts: 1, lastError: 'Server error 500' }),
    ]);
  });

  it('leaves items no handler can upload yet in the queue', async () => {
    const db = await freshDb();
    await enqueue(db, 'hike', 'a', 1000);

    expect(await processOutbox(db, {}, clock(2000))).toEqual({ uploaded: 0, failed: 0, skipped: 1 });
    expect(await countPending(db)).toBe(1);
  });

  it('skips items that are not due yet', async () => {
    const db = await freshDb();
    await enqueue(db, 'hike', 'later', 5000);
    const upload = jest.fn(async () => {});

    expect(await processOutbox(db, { hike: upload }, clock(2000))).toEqual({
      uploaded: 0,
      failed: 0,
      skipped: 0,
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it('gets through more items than one batch', async () => {
    const db = await freshDb();
    for (let i = 0; i < 45; i++) await enqueue(db, 'hike', `h${i}`, 1000);

    const run = await processOutbox(db, {}, clock(2000));
    expect(run.skipped).toBe(45);
  });
});
