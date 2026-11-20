import { createHike, setHikeStatus, setSyncStatus } from '../hikes';
import { prepareDatabase } from '../migrations';
import {
  countPending,
  countWaiting,
  enqueue,
  enqueueUnsyncedHikes,
  getDueItems,
  getNextAttemptAt,
  makeAllDue,
  markDone,
  markFailed,
} from '../outbox';
import { addTrackPoints } from '../track-points';
import { createTestDb } from './test-db';

/** The signed-in account in these tests: hikes and posts belong to an account. */
const USER = 'user-1';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

const point = { recordedAt: 1, lat: 14.6, lng: 121.0 };

/**
 * Queues the hike `id` of `owner`. The queue only hands out items whose hike
 * belongs to the signed-in account, so each needs a hike row (bare is enough).
 */
async function enqueueHike(
  db: Awaited<ReturnType<typeof freshDb>>,
  id: string,
  at?: number,
  owner = USER,
) {
  await db.runAsync(
    'INSERT OR IGNORE INTO hikes (id, user_id, started_at, client_updated_at) VALUES (?, ?, 0, 0)',
    [id, owner],
  );
  await enqueue(db, 'hike', id, at);
}

describe('enqueue', () => {
  it('queues an item, due at once', async () => {
    const db = await freshDb();
    await enqueueHike(db, 'h1', 1000);

    expect(await getDueItems(db, USER, 1000)).toEqual([
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
    await enqueueHike(db, 'h1', 1000);
    const [item] = await getDueItems(db, USER, 1000);
    await markFailed(db, item.id, 'offline', 60_000);

    await enqueueHike(db, 'h1', 2000);
    expect(await countPending(db, USER)).toBe(1);
    expect(await getDueItems(db, USER, 2000)).toEqual([]); // still backing off
  });
});

describe('getDueItems', () => {
  it('returns only due items, oldest due first', async () => {
    const db = await freshDb();
    await enqueueHike(db, 'later', 5000);
    await enqueueHike(db, 'first', 1000);
    await enqueueHike(db, 'second', 2000);

    expect((await getDueItems(db, USER, 3000)).map((i) => i.entityId)).toEqual(['first', 'second']);
    expect((await getDueItems(db, USER, 9000, 2)).map((i) => i.entityId)).toEqual(['first', 'second']);
  });
});

describe('markDone and markFailed', () => {
  it('removes an uploaded item', async () => {
    const db = await freshDb();
    await enqueueHike(db, 'h1');
    const [item] = await getDueItems(db, USER);
    await markDone(db, item.id);
    expect(await countPending(db, USER)).toBe(0);
  });

  it('counts failures and waits until the retry time', async () => {
    const db = await freshDb();
    await enqueueHike(db, 'h1', 1000);
    const [item] = await getDueItems(db, USER, 1000);

    await markFailed(db, item.id, 'Network request failed', 31_000);
    await markFailed(db, item.id, 'Server error 500', 91_000);

    expect(await getDueItems(db, USER, 90_000)).toEqual([]);
    expect(await getDueItems(db, USER, 91_000)).toEqual([
      expect.objectContaining({ attempts: 2, lastError: 'Server error 500', nextAttemptAt: 91_000 }),
    ]);
  });
});

describe('enqueueUnsyncedHikes', () => {
  it('queues finished hikes with points, and nothing else', async () => {
    const db = await freshDb();

    const finished = await createHike(db, USER, 1000);
    await addTrackPoints(db, finished.id, [point]);
    await setHikeStatus(db, finished.id, 'finished');

    const recording = await createHike(db, USER, 2000);
    await addTrackPoints(db, recording.id, [point]);

    const paused = await createHike(db, USER, 3000);
    await addTrackPoints(db, paused.id, [point]);
    await setHikeStatus(db, paused.id, 'paused');

    const empty = await createHike(db, USER, 4000);
    await setHikeStatus(db, empty.id, 'finished');

    const synced = await createHike(db, USER, 5000);
    await addTrackPoints(db, synced.id, [point]);
    await setHikeStatus(db, synced.id, 'finished');
    await db.runAsync("UPDATE hikes SET sync_status = 'synced' WHERE id = ?", [synced.id]);

    expect(await enqueueUnsyncedHikes(db, USER, 9000)).toBe(1);
    expect((await getDueItems(db, USER, 9000)).map((i) => [i.kind, i.entityId])).toEqual([
      ['hike', finished.id],
    ]);

    // Running it again (e.g. next app start) queues nothing new.
    expect(await enqueueUnsyncedHikes(db, USER, 9500)).toBe(0);
    expect(await countPending(db, USER)).toBe(1);
  });
});

describe('enqueueUnsyncedHikes and upload status', () => {
  async function finishedWithPoint(db: Awaited<ReturnType<typeof freshDb>>, startedAt: number) {
    const hike = await createHike(db, USER, startedAt);
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

    await enqueueUnsyncedHikes(db, USER, 9000);
    expect((await getDueItems(db, USER, 9000)).map((i) => i.entityId)).toEqual([interrupted.id]);
  });
});

describe('getNextAttemptAt', () => {
  it('is when the soonest item is due, or null when nothing waits', async () => {
    const db = await freshDb();
    expect(await getNextAttemptAt(db, USER)).toBeNull();

    await enqueueHike(db, 'a', 5000);
    await enqueueHike(db, 'b', 3000);
    expect(await getNextAttemptAt(db, USER)).toBe(3000);
  });
});

describe('countWaiting', () => {
  it('counts waiting items, and those backing off after a failed try', async () => {
    const db = await freshDb();
    expect(await countWaiting(db, USER, 'hike', 1000)).toEqual({ waiting: 0, backingOff: 0 });

    await enqueueHike(db, 'fresh', 1000);
    await enqueueHike(db, 'failed-once', 1000);
    const [, failed] = await getDueItems(db, USER, 1000);
    await markFailed(db, failed.id, 'offline', 61_000);

    expect(await countWaiting(db, USER, 'hike', 2000)).toEqual({ waiting: 2, backingOff: 1 });
    // Once its wait is over it's due again, not backing off.
    expect(await countWaiting(db, USER, 'hike', 61_000)).toEqual({ waiting: 2, backingOff: 0 });
  });
});

describe('makeAllDue', () => {
  it('cuts short every backoff wait, keeping the attempt count', async () => {
    const db = await freshDb();
    await enqueueHike(db, 'h1', 1000);
    const [item] = await getDueItems(db, USER, 1000);
    await markFailed(db, item.id, 'offline', 3_600_000);

    await makeAllDue(db, USER, 2000);
    expect(await getDueItems(db, USER, 2000)).toEqual([
      expect.objectContaining({ entityId: 'h1', attempts: 1, nextAttemptAt: 2000 }),
    ]);
  });
});

describe('two accounts on one phone', () => {
  const OTHER = 'user-2';

  it("hands out, counts and hurries only the signed-in account's items", async () => {
    const db = await freshDb();
    await enqueueHike(db, 'mine', 1000);
    await enqueueHike(db, 'theirs', 1000, OTHER);
    const [theirs] = await getDueItems(db, OTHER, 1000);
    await markFailed(db, theirs.id, 'offline', 60_000);

    expect((await getDueItems(db, USER, 1000)).map((i) => i.entityId)).toEqual(['mine']);
    expect(await countPending(db, USER)).toBe(1);
    expect(await countWaiting(db, USER, 'hike', 1000)).toEqual({ waiting: 1, backingOff: 0 });
    expect(await getNextAttemptAt(db, USER)).toBe(1000);

    // Retry as USER leaves the other account's backoff alone.
    await makeAllDue(db, USER, 2000);
    expect(await getNextAttemptAt(db, OTHER)).toBe(60_000);
  });

  it("queues only the signed-in account's finished hikes", async () => {
    const db = await freshDb();
    for (const owner of [USER, OTHER]) {
      const hike = await createHike(db, owner, owner === USER ? 1000 : 2000);
      await addTrackPoints(db, hike.id, [point]);
      await setHikeStatus(db, hike.id, 'finished');
    }

    expect(await enqueueUnsyncedHikes(db, USER, 9000)).toBe(1);
    expect(await countPending(db, OTHER)).toBe(0);
  });

  it('counts a post item for the owner of its hike', async () => {
    const db = await freshDb();
    const hike = await createHike(db, OTHER, 1000);
    await db.runAsync(
      "INSERT INTO posts (id, hike_id, created_at) VALUES ('post-1', ?, 1000)",
      [hike.id],
    );
    await enqueue(db, 'post', 'post-1', 1000);

    expect(await countPending(db, USER)).toBe(0);
    expect((await getDueItems(db, OTHER, 1000)).map((i) => [i.kind, i.entityId])).toEqual([
      ['post', 'post-1'],
    ]);
  });
});
