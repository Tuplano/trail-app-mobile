import {
  countFailedHikes,
  createHike,
  deleteHike,
  getHike,
  getRecordingHike,
  resetFailedHikes,
  setHikeStatus,
  setSyncStatus,
} from '../hikes';
import { prepareDatabase } from '../migrations';
import { createTestDb } from './test-db';
import { addTrackPoints, getTrackPoints } from '../track-points';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

describe('setHikeStatus', () => {
  it('saves pauses and resumes without an end time', async () => {
    const db = await freshDb();
    const { id } = await createHike(db, 1000);

    await setHikeStatus(db, id, 'paused', 2000);
    expect(await getHike(db, id)).toMatchObject({
      status: 'paused',
      endedAt: null,
      clientUpdatedAt: 2000,
    });

    await setHikeStatus(db, id, 'recording', 3000);
    expect(await getHike(db, id)).toMatchObject({ status: 'recording', endedAt: null });
  });

  it('records the end time when finishing', async () => {
    const db = await freshDb();
    const { id } = await createHike(db, 1000);
    await setHikeStatus(db, id, 'finished', 5000);
    expect(await getHike(db, id)).toMatchObject({
      status: 'finished',
      endedAt: 5000,
      clientUpdatedAt: 5000,
    });
  });

  it('fails for an unknown hike', async () => {
    const db = await freshDb();
    await expect(setHikeStatus(db, 'nope', 'paused')).rejects.toThrow(/not found/);
  });
});

describe('getRecordingHike', () => {
  it('is the newest recording hike, and null when none is recording', async () => {
    const db = await freshDb();
    expect(await getRecordingHike(db)).toBeNull();

    const older = await createHike(db, 1000);
    const newer = await createHike(db, 2000);
    expect(await getRecordingHike(db)).toEqual({ id: newer.id, startedAt: 2000 });

    await setHikeStatus(db, newer.id, 'paused');
    expect(await getRecordingHike(db)).toEqual({ id: older.id, startedAt: 1000 });

    await setHikeStatus(db, older.id, 'finished');
    expect(await getRecordingHike(db)).toBeNull();
  });
});

describe('deleteHike', () => {
  it('removes the hike and its points', async () => {
    const db = await freshDb();
    const { id } = await createHike(db);
    await addTrackPoints(db, id, [{ recordedAt: 1, lat: 1, lng: 1 }]);

    await deleteHike(db, id);
    expect(await getHike(db, id)).toBeNull();
    expect(await getTrackPoints(db, id)).toEqual([]);
  });
});

describe('failed uploads', () => {
  it('counts finished hikes the upload gave up on, and resets them for a retry', async () => {
    const db = await freshDb();
    const failed = await createHike(db, 1000);
    await setHikeStatus(db, failed.id, 'finished', 2000);
    await setSyncStatus(db, failed.id, 'failed');
    const synced = await createHike(db, 3000);
    await setHikeStatus(db, synced.id, 'finished', 4000);
    await setSyncStatus(db, synced.id, 'synced');
    expect(await countFailedHikes(db)).toBe(1);

    expect(await resetFailedHikes(db)).toBe(1);
    expect(await countFailedHikes(db)).toBe(0);
    expect(await getHike(db, failed.id)).toMatchObject({ syncStatus: 'pending' });
    expect(await getHike(db, synced.id)).toMatchObject({ syncStatus: 'synced' });
  });
});
