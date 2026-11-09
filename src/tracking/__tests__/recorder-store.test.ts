import { createHike, getHike, setHikeStatus } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { createTestDb } from '@/db/__tests__/test-db';
import { getDueItems } from '@/db/outbox';
import { addTrackPoints } from '@/db/track-points';
import type { Db } from '@/db/types';

import { EMPTY_STATS } from '../hike-stats';
import { useLiveTrackStore } from '../live-track-store';
import { LocationPermissionError, requireLocationAccess } from '../location-permission';
import { ensureLocationUpdates, startLocationUpdates, stopLocationUpdates } from '../location-task';
import { canTransition, useRecorderStore } from '../recorder-store';

// The recorder saves to a real in-memory SQLite database (see db/__tests__/test-db.ts).
let mockDb: Promise<Db>;
jest.mock('@/db/database', () => ({ getDb: () => mockDb }));
jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));
// GPS is native, so it's replaced with mocks we can check and make fail.
jest.mock('../location-permission', () => ({
  LocationPermissionError: class LocationPermissionError extends Error {},
  requireLocationAccess: jest.fn(),
}));
jest.mock('../location-task', () => ({
  ensureLocationUpdates: jest.fn(),
  startLocationUpdates: jest.fn(),
  stopLocationUpdates: jest.fn(),
}));

const askPermission = jest.mocked(requireLocationAccess);
const ensureGps = jest.mocked(ensureLocationUpdates);
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

  it('starts each hike with empty stats and an empty track', async () => {
    useLiveTrackStore.setState({
      stats: { ...EMPTY_STATS, pointCount: 1, distanceM: 900 },
      path: [{ recordedAt: 1, lat: 1, lng: 1, altitudeM: null }],
    });
    await recorder().start();
    expect(useLiveTrackStore.getState()).toMatchObject({ stats: EMPTY_STATS, path: [] });
  });

  it('remembers when the hike started and ended, for the clock', async () => {
    const db = await mockDb;
    await recorder().start();
    const hike = await getHike(db, recorder().hikeId!);
    expect(recorder()).toMatchObject({ startedAt: hike!.startedAt, endedAt: null });

    await recorder().finish();
    const { endedAt } = recorder();
    expect(endedAt).toBe((await getHike(db, hike!.id))!.endedAt);

    recorder().reset();
    expect(recorder()).toMatchObject({ startedAt: null, endedAt: null });
  });

  it('saves nothing without full location access', async () => {
    askPermission.mockRejectedValue(new LocationPermissionError('ask-background'));
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
    askPermission.mockRejectedValue(new LocationPermissionError('foreground-blocked'));
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

describe('restoring after the app restarts', () => {
  /** A hike left in the database by an app that was killed mid-hike. */
  async function leftBehind(status: 'recording' | 'paused') {
    const db = await mockDb;
    const hike = await createHike(db, 1_000_000);
    await addTrackPoints(db, hike.id, [
      { recordedAt: 1_000_000, lat: 14.6, lng: 121.0, altitudeM: 100 },
      { recordedAt: 1_010_000, lat: 14.6001, lng: 121.0, altitudeM: 100 },
    ]);
    if (status === 'paused') await setHikeStatus(db, hike.id, 'paused');
    return hike;
  }

  it('picks a recording hike back up: screen, stats, map and GPS', async () => {
    const hike = await leftBehind('recording');

    await recorder().restore();

    expect(recorder()).toMatchObject({
      status: 'recording',
      hikeId: hike.id,
      startedAt: 1_000_000,
      endedAt: null,
      restored: true,
      saving: false,
    });
    expect(ensureGps).toHaveBeenCalled();
    expect(useLiveTrackStore.getState().stats.pointCount).toBe(2);
    expect(useLiveTrackStore.getState().path).toHaveLength(2);
  });

  it('restores a paused hike as paused, with GPS off', async () => {
    await leftBehind('paused');
    await recorder().restore();
    expect(recorder()).toMatchObject({ status: 'paused', restored: true });
    expect(stopGps).toHaveBeenCalled();
    expect(ensureGps).not.toHaveBeenCalled();
  });

  it('pauses the hike if GPS can no longer run', async () => {
    const hike = await leftBehind('recording');
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    askPermission.mockRejectedValue(new LocationPermissionError('foreground-blocked'));

    await recorder().restore();

    expect(recorder().status).toBe('paused');
    expect((await getHike(await mockDb, hike.id))?.status).toBe('paused');
  });

  it('stays idle with no unfinished hike, and stops stray GPS', async () => {
    await recorder().restore();
    expect(recorder()).toMatchObject({ status: 'idle', hikeId: null, restored: false });
    expect(stopGps).toHaveBeenCalled();
  });

  it('leaves a hike already on screen alone', async () => {
    await recorder().start();
    const { hikeId } = recorder();
    await recorder().restore();
    expect(recorder()).toMatchObject({ hikeId, restored: false });
  });

  it('clears the restored note on the next change', async () => {
    await leftBehind('recording');
    await recorder().restore();
    await recorder().pause();
    expect(recorder().restored).toBe(false);
  });
});

describe('queuing for upload', () => {
  it('puts the hike in the outbox when it is finished', async () => {
    const db = await mockDb;
    await recorder().start();
    const { hikeId } = recorder();
    await addTrackPoints(db, hikeId!, [{ recordedAt: Date.now(), lat: 14.6, lng: 121.0 }]);
    expect(await getDueItems(db)).toEqual([]); // not while recording

    await recorder().finish();
    expect((await getDueItems(db)).map((i) => i.entityId)).toEqual([hikeId]);
  });
});
