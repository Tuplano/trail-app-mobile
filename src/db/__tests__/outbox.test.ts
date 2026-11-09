import { createHike, setHikeStatus, setSyncStatus } from '../hikes';
import { prepareDatabase } from '../migrations';
import {
  countPending,
  enqueue,
  enqueueUnsyncedHikes,
  getDueItems,
  getNextAttemptAt,
  markDone,
  markFailed,
} from '../outbox';
import { addTrackPoints } from '../track-points';
import { createTestDb } from './test-db';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

const point = { recordedAt: 1, lat: 14.6, lng: 121.0 };

describe('enqueue', () => {
  it('queues an item, due at once', async () => {
    const db = await freshDb();
    await enqueue(db, 'hike', 'h1', 1000);

    expect(await getDueItems(db, 1000)).toEqual([
      {
        id: expect.any(Number),
        kind: 'hike',
        entityId: 'h1',
        attempts: 0,
        lastError: null,
        nextAttemptAt: 1000,
        createdAt: 1000,
      },
    ]);
  });

  it('queues the same thing only once, keeping its retry time', async () => {
    const db = await freshDb();
    await enqueue(db, 'hike', 'h1', 1000);
    const [item] = await getDueItems(db, 1000);
    await markFailed(db, item.id, 'offline', 60_000);

    await enqueue(db, 'hike', 'h1', 2000);
    expect(await countPending(db)).toBe(1);
    expect(await getDueItems(db, 2000)).toEqual([]); // still backing off
  });
});

describe('getDueItems', () => {
  it('returns only due items, oldest due first', async () => {
    const db = await freshDb();
    await enqueue(db, 'hike', 'later', 5000);
    await enqueue(db, 'hike', 'first', 1000);
    await enqueue(db, 'hike', 'second', 2000);

    expect((await getDueItems(db, 3000)).map((i) => i.entityId)).toEqual(['first', 'second']);
    expect((await getDueItems(db, 9000, 2)).map((i) => i.entityId)).toEqual(['first', 'second']);
  });
});

describe('markDone and markFailed', () => {
  it('removes an uploaded item', async () => {
    const db = await freshDb();
    await enqueue(db, 'hike', 'h1');
    const [item] = await getDueItems(db);
    await markDone(db, item.id);
    expect(await countPending(db)).toBe(0);
  });

  it('counts failures and waits until the retry time', async () => {
    const db = await freshDb();
    await enqueue(db, 'hike', 'h1', 1000);
    const [item] = await getDueItems(db, 1000);

    await markFailed(db, item.id, 'Network request failed', 31_000);
    await markFailed(db, item.id, 'Server error 500', 91_000);

    expect(await getDueItems(db, 90_000)).toEqual([]);
    expect(await getDueItems(db, 91_000)).toEqual([
      expect.objectContaining({ attempts: 2, lastError: 'Server error 500', nextAttemptAt: 91_000 }),
    ]);
  });
});

describe('enqueueUnsyncedHikes', () => {
  it('queues finished hikes with points, and nothing else', async () => {
    const db = await freshDb();

    const finished = await createHike(db, 1000);
    await addTrackPoints(db, finished.id, [point]);
    await setHikeStatus(db, finished.id, 'finished');

    const recording = await createHike(db, 2000);
    await addTrackPoints(db, recording.id, [point]);

    const paused = await createHike(db, 3000);
    await addTrackPoints(db, paused.id, [point]);
    await setHikeStatus(db, paused.id, 'paused');

    const empty = await createHike(db, 4000);
    await setHikeStatus(db, empty.id, 'finished');

    const synced = await createHike(db, 5000);
    await addTrackPoints(db, synced.id, [point]);
    await setHikeStatus(db, synced.id, 'finished');
    await db.runAsync("UPDATE hikes SET sync_status = 'synced' WHERE id = ?", [synced.id]);

    expect(await enqueueUnsyncedHikes(db, 9000)).toBe(1);
    expect((await getDueItems(db, 9000)).map((i) => [i.kind, i.entityId])).toEqual([
      ['hike', finished.id],
    ]);

    // Running it again (e.g. next app start) queues nothing new.
    expect(await enqueueUnsyncedHikes(db, 9500)).toBe(0);
    expect(await countPending(db)).toBe(1);
  });
});

describe('enqueueUnsyncedHikes and upload status', () => {
  async function finishedWithPoint(db: Awaited<ReturnType<typeof freshDb>>, startedAt: number) {
    const hike = await createHike(db, startedAt);
    await addTrackPoints(db, hike.id, [point]);
    await setHikeStatus(db, hike.id, 'finished');
    return hike;
  }

  it('re-queues a hike the app stopped uploading midway, but not one given up on', async () => {
    const db = await freshDb();
    const interrupted = await finishedWithPoint(db, 1000);
    await setSyncStatus(db, interrupted.id, 'syncing');
    const givenUp = await finishedWithPoint(db, 2000);
    await setSyncStatus(db, givenUp.id, 'failed');

    await enqueueUnsyncedHikes(db, 9000);
    expect((await getDueItems(db, 9000)).map((i) => i.entityId)).toEqual([interrupted.id]);
  });
});

describe('getNextAttemptAt', () => {
  it('is when the soonest item is due, or null when nothing waits', async () => {
    const db = await freshDb();
    expect(await getNextAttemptAt(db)).toBeNull();

    await enqueue(db, 'hike', 'a', 5000);
    await enqueue(db, 'hike', 'b', 3000);
    expect(await getNextAttemptAt(db)).toBe(3000);
  });
});
