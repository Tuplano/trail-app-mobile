import { countNotUploaded, wipeAccountData } from '../account-data';
import { createHike, setHikeStatus, setSyncStatus } from '../hikes';
import { prepareDatabase } from '../migrations';
import { countPending } from '../outbox';
import { createPost } from '../posts';
import { getSettings, setSetting } from '../settings';
import { addTrackPoints } from '../track-points';
import { createTestDb } from './test-db';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

const point = (recordedAt: number) => ({ recordedAt, lat: 16.5, lng: 120.5, altitudeM: null });

/** A phone with an uploaded hike, an unsent hike with a queued post and photo, and a setting. */
async function usedPhone() {
  const db = createTestDb();
  await prepareDatabase(db);

  const uploaded = await createHike(db, 1000);
  await addTrackPoints(db, uploaded.id, [point(1000), point(2000)]);
  await setHikeStatus(db, uploaded.id, 'finished', 3000);
  await setSyncStatus(db, uploaded.id, 'synced');

  const waiting = await createHike(db, 10_000);
  await addTrackPoints(db, waiting.id, [point(10_000)]);
  await setHikeStatus(db, waiting.id, 'finished', 11_000);
  await createPost(db, {
    hikeId: waiting.id,
    caption: 'Sunrise',
    visibility: 'public',
    photos: [{ id: 'photo-1', fileUri: 'file:///p.jpg', contentType: 'image/jpeg', sizeBytes: 10 }],
  });

  // Never got a GPS fix: it never uploads, so it doesn't count as waiting.
  const empty = await createHike(db, 20_000);
  await setHikeStatus(db, empty.id, 'finished', 21_000);

  await setSetting(db, 'photosOnWifiOnly', false);
  return db;
}

describe('countNotUploaded', () => {
  it('counts hikes with points and posts the server does not have yet', async () => {
    const db = await usedPhone();
    expect(await countNotUploaded(db)).toEqual({ hikes: 1, posts: 1 });
  });

  it('is zero on a fresh phone', async () => {
    const db = createTestDb();
    await prepareDatabase(db);
    expect(await countNotUploaded(db)).toEqual({ hikes: 0, posts: 0 });
  });
});

describe('wipeAccountData', () => {
  it('leaves nothing of the account on the phone, and nothing to upload', async () => {
    const db = await usedPhone();
    expect(await countPending(db)).toBeGreaterThan(0);

    await wipeAccountData(db);

    for (const table of ['hikes', 'track_points', 'posts', 'post_photos', 'outbox', 'settings']) {
      const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      expect([table, row?.n]).toEqual([table, 0]);
    }
    expect(await countPending(db)).toBe(0);
    expect((await getSettings(db)).photosOnWifiOnly).toBe(true); // back to the default
  });
});
