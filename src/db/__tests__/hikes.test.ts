import {
  countFailedHikes,
  createHike,
  deleteHike,
  getHike,
  getRecordingHike,
  listFinishedHikes,
  resetFailedHikes,
  setHikeStatus,
  setHikeTitle,
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

const POINT = { recordedAt: 1500, lat: 14.5, lng: 121 };

describe('listFinishedHikes', () => {
  it('lists only finished hikes, newest first', async () => {
    const db = await freshDb();
    const older = await createHike(db, 1000);
    const newer = await createHike(db, 5000);
    const unfinished = await createHike(db, 9000);
    for (const hike of [older, newer, unfinished]) await addTrackPoints(db, hike.id, [POINT]);
    await addTrackPoints(db, older.id, [{ ...POINT, recordedAt: 1600 }]);
    await setHikeStatus(db, older.id, 'finished', 2000);
    await setHikeStatus(db, newer.id, 'finished', 6000);
    await setHikeStatus(db, unfinished.id, 'paused', 9500);

    const hikes = await listFinishedHikes(db);
    expect(hikes.map((h) => h.id)).toEqual([newer.id, older.id]);
    expect(hikes[1].pointCount).toBe(2);
    expect(hikes[0]).toMatchObject({
      startedAt: 5000,
      endedAt: 6000,
      syncStatus: 'pending',
      pointCount: 1,
    });
  });

  it('is empty before any hike is finished', async () => {
    const db = await freshDb();
    const { id } = await createHike(db, 1000);
    await addTrackPoints(db, id, [POINT]);
    expect(await listFinishedHikes(db)).toEqual([]);
  });

  it('leaves out finished hikes without any GPS point', async () => {
    const db = await freshDb();
    const empty = await createHike(db, 1000);
    await setHikeStatus(db, empty.id, 'finished', 2000);
    expect(await listFinishedHikes(db)).toEqual([]);
  });
});

describe('setHikeTitle', () => {
  it('names the hike and counts it as an edit', async () => {
    const db = await freshDb();
    const { id } = await createHike(db, 1000);
    await setHikeTitle(db, id, 'Mt. Pulag', 9000);
    expect(await getHike(db, id)).toMatchObject({ title: 'Mt. Pulag', clientUpdatedAt: 9000 });

    await setHikeTitle(db, id, null, 9500);
    expect((await getHike(db, id))?.title).toBeNull();
  });

  it('fails for an unknown hike', async () => {
    const db = await freshDb();
    await expect(setHikeTitle(db, 'nope', 'x')).rejects.toThrow(/not found/);
  });
});
