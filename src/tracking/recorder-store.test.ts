import { getHike } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { createTestDb } from '@/db/test-db';
import type { Db } from '@/db/types';

import { useLiveTrackStore } from './live-track-store';
import {
  ensureLocationPermission,
  LocationPermissionError,
  startLocationUpdates,
  stopLocationUpdates,
} from './location-task';
import { canTransition, useRecorderStore } from './recorder-store';

// The recorder saves to a real in-memory SQLite database (see db/test-db.ts).
let mockDb: Promise<Db>;
jest.mock('@/db/database', () => ({ getDb: () => mockDb }));
jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));
// GPS is native, so it's replaced with mocks we can check and make fail.
jest.mock('./location-task', () => ({
  LocationPermissionError: class LocationPermissionError extends Error {},
  ensureLocationPermission: jest.fn(),
  startLocationUpdates: jest.fn(),
  stopLocationUpdates: jest.fn(),
}));

const askPermission = jest.mocked(ensureLocationPermission);
const startGps = jest.mocked(startLocationUpdates);
const stopGps = jest.mocked(stopLocationUpdates);

const initialState = useRecorderStore.getState();
const recorder = () => useRecorderStore.getState();

beforeEach(() => {
  jest.resetAllMocks();
  useRecorderStore.setState(initialState, true);
  mockDb = (async () => {
    const db = createTestDb();
    await prepareDatabase(db);
    return db;
  })();
});

const hikeCount = async () =>
  (await (await mockDb).getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM hikes'))?.n;

describe('recorder store', () => {
  it('saves every step of a hike to the database', async () => {
    const db = await mockDb;

    await recorder().start();
    const { hikeId } = recorder();
    expect(recorder()).toMatchObject({ status: 'recording', saving: false });
    expect(await getHike(db, hikeId!)).toMatchObject({ status: 'recording', endedAt: null });

    await recorder().pause();
    expect(recorder().status).toBe('paused');
    expect((await getHike(db, hikeId!))?.status).toBe('paused');

    await recorder().resume();
    expect((await getHike(db, hikeId!))?.status).toBe('recording');

    await recorder().finish();
    expect(recorder().status).toBe('finished');
    const finished = await getHike(db, hikeId!);
    expect(finished).toMatchObject({ status: 'finished', syncStatus: 'pending' });
    expect(finished?.endedAt).toEqual(expect.any(Number));

    recorder().reset();
    expect(recorder()).toMatchObject({ status: 'idle', hikeId: null });
    expect((await getHike(db, hikeId!))?.status).toBe('finished'); // the hike stays saved
  });

  it('runs GPS only while recording', async () => {
    await recorder().start();
    expect(startGps).toHaveBeenCalledTimes(1);

    await recorder().pause();
    expect(stopGps).toHaveBeenCalledTimes(1);

    await recorder().resume();
    expect(startGps).toHaveBeenCalledTimes(2);

    await recorder().finish();
    expect(stopGps).toHaveBeenCalledTimes(2);
  });

  it('starts a fresh point count for each hike', async () => {
    useLiveTrackStore.setState({ pointCount: 42 });
    await recorder().start();
    expect(useLiveTrackStore.getState().pointCount).toBe(0);
  });

  it('saves nothing when location permission is refused', async () => {
    askPermission.mockRejectedValue(new LocationPermissionError('background'));
    await expect(recorder().start()).rejects.toBeInstanceOf(LocationPermissionError);
    expect(recorder()).toMatchObject({ status: 'idle', hikeId: null, saving: false });
    expect(startGps).not.toHaveBeenCalled();
    expect(await hikeCount()).toBe(0);
  });

  it('removes the new hike when GPS fails to start', async () => {
    startGps.mockRejectedValue(new Error('location services off'));
    await expect(recorder().start()).rejects.toThrow('location services off');
    expect(recorder().status).toBe('idle');
    expect(await hikeCount()).toBe(0);
  });

  it('still pauses when GPS fails to stop', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await recorder().start();
    stopGps.mockRejectedValue(new Error('stuck'));
    await recorder().pause();
    expect(recorder().status).toBe('paused');
    expect((await getHike(await mockDb, recorder().hikeId!))?.status).toBe('paused');
  });

  it('stays paused when resuming without permission', async () => {
    await recorder().start();
    await recorder().pause();
    askPermission.mockRejectedValue(new LocationPermissionError('foreground'));
    await expect(recorder().resume()).rejects.toBeInstanceOf(LocationPermissionError);
    expect(recorder().status).toBe('paused');
    expect((await getHike(await mockDb, recorder().hikeId!))?.status).toBe('paused');
  });

  it('rejects invalid transitions without touching the database', async () => {
    await expect(recorder().pause()).rejects.toThrow(/idle to paused/);
    await expect(recorder().finish()).rejects.toThrow(/idle to finished/);
    expect(() => recorder().reset()).toThrow(/idle to idle/);
    expect(await hikeCount()).toBe(0);
    expect(canTransition('finished', 'recording')).toBe(false);
  });

  it('creates one hike when Start is tapped twice quickly', async () => {
    const first = recorder().start();
    await expect(recorder().start()).rejects.toThrow(/still saving/);
    await first;
    expect(recorder().status).toBe('recording');
    expect(await hikeCount()).toBe(1);
  });

  it('stays where it was when saving fails', async () => {
    mockDb = Promise.reject(new Error('disk full'));
    await expect(recorder().start()).rejects.toThrow('disk full');
    expect(recorder()).toMatchObject({ status: 'idle', hikeId: null, saving: false });
  });
});
