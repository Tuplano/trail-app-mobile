import { countNotUploaded, wipeAccountData } from '../account-data';
import { createHike, setHikeStatus, setSyncStatus } from '../hikes';
import { prepareDatabase } from '../migrations';
import { countPending } from '../outbox';
import { createPost } from '../posts';
import { getSettings, setSetting } from '../settings';
import { addTrackPoints } from '../track-points';
import { createTestDb } from './test-db';

/** The signed-in account in these tests: hikes and posts belong to an account. */
const USER = 'user-1';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

const point = (recordedAt: number) => ({ recordedAt, lat: 16.5, lng: 120.5, altitudeM: null });

/** A phone with an uploaded hike, an unsent hike with a queued post and photo, and a setting. */
async function usedPhone() {
  const db = createTestDb();
  await prepareDatabase(db);

  const uploaded = await createHike(db, USER, 1000);
  await addTrackPoints(db, uploaded.id, [point(1000), point(2000)]);
  await setHikeStatus(db, uploaded.id, 'finished', 3000);
  await setSyncStatus(db, uploaded.id, 'synced');

  const waiting = await createHike(db, USER, 10_000);
  await addTrackPoints(db, waiting.id, [point(10_000)]);
  await setHikeStatus(db, waiting.id, 'finished', 11_000);
  await createPost(db, {
    hikeId: waiting.id,
    caption: 'Sunrise',
    visibility: 'public',
    photos: [{ id: 'photo-1', fileUri: 'file:///p.jpg', contentType: 'image/jpeg', sizeBytes: 10 }],
  });

  // Never got a GPS fix: it never uploads, so it doesn't count as waiting.
  const empty = await createHike(db, USER, 20_000);
  await setHikeStatus(db, empty.id, 'finished', 21_000);

  await setSetting(db, 'photosOnWifiOnly', false);
  return db;
}

describe('countNotUploaded', () => {
  it('counts hikes with points and posts the server does not have yet', async () => {
    const db = await usedPhone();
    expect(await countNotUploaded(db, USER)).toEqual({ hikes: 1, posts: 1 });
  });

  it('is zero on a fresh phone', async () => {
    const db = createTestDb();
    await prepareDatabase(db);
    expect(await countNotUploaded(db, USER)).toEqual({ hikes: 0, posts: 0 });
  });
});

describe('wipeAccountData', () => {
  it('leaves nothing of the account on the phone, and nothing to upload', async () => {
    const db = await usedPhone();
    expect(await countPending(db, USER)).toBeGreaterThan(0);

    const files = await wipeAccountData(db, USER);

    for (const table of ['hikes', 'track_points', 'posts', 'post_photos', 'outbox']) {
      const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      expect([table, row?.n]).toEqual([table, 0]);
    }
    expect(await countPending(db, USER)).toBe(0);
    // Its files are handed back to delete; the phone's settings stay.
    expect(files).toEqual(['file:///p.jpg']);
    expect((await getSettings(db)).photosOnWifiOnly).toBe(false);
  });

  it("keeps another account's hikes, posts and queue", async () => {
    const db = await usedPhone();
    const other = await createHike(db, 'user-2', 30_000);
    await addTrackPoints(db, other.id, [point(30_000)]);
    await setHikeStatus(db, other.id, 'finished', 31_000);
    await createPost(db, { hikeId: other.id, caption: null, visibility: 'public', photos: [] });

    await wipeAccountData(db, USER);

    expect(await countNotUploaded(db, 'user-2')).toEqual({ hikes: 1, posts: 1 });
    expect(await countPending(db, 'user-2')).toBe(1);
  });
});

describe('countNotUploaded for two accounts', () => {
  it("counts only the account's own", async () => {
    const db = await usedPhone();
    expect(await countNotUploaded(db, 'user-2')).toEqual({ hikes: 0, posts: 0 });
  });
});
