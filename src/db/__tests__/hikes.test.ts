import {
  clearImportFile,
  countFailedHikes,
  createHike,
  createImportedHike,
  deleteHike,
  findOverlappingHike,
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

describe('createImportedHike', () => {
  const points = [
    { recordedAt: 1000, lat: 16.5, lng: 120.5, altitudeM: 2200 },
    { recordedAt: 61_000, lat: 16.51, lng: 120.5, altitudeM: null },
  ];
  const input = {
    id: 'imported-1',
    title: 'Mt. Pulag',
    startedAt: 1000,
    endedAt: 61_000,
    fileUri: 'file:///docs/gpx-imports/imported-1.gpx',
    stats: { distanceM: 1112, elevationGainM: 0, movingTimeS: 60 },
    points,
  };

  it('saves a finished, imported hike with its points, waiting to upload', async () => {
    const db = await freshDb();
    const hike = await createImportedHike(db, input);
    expect(hike).toMatchObject({
      id: 'imported-1',
      title: 'Mt. Pulag',
      status: 'finished',
      startedAt: 1000,
      endedAt: 61_000,
      syncStatus: 'pending',
      source: 'imported',
      importFileUri: input.fileUri,
      distanceM: 1112,
      movingTimeS: 60,
    });
    expect((await getTrackPoints(db, 'imported-1', 0, 10)).map((p) => p.seq)).toEqual([0, 1]);
    expect(await listFinishedHikes(db)).toEqual([expect.objectContaining({ id: 'imported-1', pointCount: 2 })]);
  });

  it('saves nothing when the points are refused', async () => {
    const db = await freshDb();
    const bad = { ...input, points: [...points, { recordedAt: 2, lat: 200, lng: 0, altitudeM: null }] };
    await expect(createImportedHike(db, bad)).rejects.toThrow();
    expect(await getHike(db, 'imported-1')).toBeNull();
  });

  it('forgets the file once uploaded', async () => {
    const db = await freshDb();
    await createImportedHike(db, input);
    await clearImportFile(db, 'imported-1');
    expect((await getHike(db, 'imported-1'))?.importFileUri).toBeNull();
  });

  it('marks hikes recorded here as recorded', async () => {
    const db = await freshDb();
    const { id } = await createHike(db, 1000);
    expect(await getHike(db, id)).toMatchObject({ source: 'recorded', importFileUri: null });
  });
});

describe('findOverlappingHike', () => {
  it('finds a hike whose time touches the range, like the API does', async () => {
    const db = await freshDb();
    const { id } = await createHike(db, 10_000);
    await setHikeStatus(db, id, 'finished', 20_000);

    expect(await findOverlappingHike(db, 0, 9_999)).toBeNull();
    expect(await findOverlappingHike(db, 20_001, 30_000)).toBeNull();
    expect(await findOverlappingHike(db, 0, 10_000)).toMatchObject({ id, startedAt: 10_000 });
    expect(await findOverlappingHike(db, 15_000, 16_000)).toMatchObject({ id });
    expect(await findOverlappingHike(db, 20_000, 25_000)).toMatchObject({ id });
  });

  it('counts a hike still being recorded from its start', async () => {
    const db = await freshDb();
    const { id } = await createHike(db, 10_000);
    expect(await findOverlappingHike(db, 5_000, 10_000)).toMatchObject({ id });
    expect(await findOverlappingHike(db, 5_000, 9_000)).toBeNull();
  });
});
