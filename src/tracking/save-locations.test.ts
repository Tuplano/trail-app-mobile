import type { LocationObject } from 'expo-location';

import { createHike, setHikeStatus } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { createTestDb } from '@/db/test-db';
import { getTrackPoints } from '@/db/track-points';

import { saveLocations, toTrackPoint } from './save-locations';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

function fix(timestamp: number, coords: Partial<LocationObject['coords']> = {}): LocationObject {
  return {
    timestamp,
    coords: {
      latitude: 14.6,
      longitude: 121.0,
      altitude: 50,
      accuracy: 5,
      altitudeAccuracy: 3,
      heading: 0,
      speed: 1.2,
      ...coords,
    },
  };
}

describe('toTrackPoint', () => {
  it('maps an expo-location fix to a track point', () => {
    expect(toTrackPoint(fix(1000))).toEqual({
      recordedAt: 1000,
      lat: 14.6,
      lng: 121.0,
      altitudeM: 50,
      accuracyM: 5,
      speedMps: 1.2,
    });
  });

  it('stores unknown values as null, including a speed of -1', () => {
    expect(toTrackPoint(fix(1000, { altitude: null, accuracy: null, speed: -1 }))).toMatchObject({
      altitudeM: null,
      accuracyM: null,
      speedMps: null,
    });
  });
});

describe('saveLocations', () => {
  it('saves fixes to the recording hike, oldest first', async () => {
    const db = await freshDb();
    const { id } = await createHike(db, 500);

    // The OS can deliver a batch out of order.
    expect(await saveLocations(db, [fix(3000), fix(1000), fix(2000)])).toBe(3);
    expect(await saveLocations(db, [fix(4000)])).toBe(1);

    const points = await getTrackPoints(db, id);
    expect(points.map((p) => [p.seq, p.recordedAt])).toEqual([
      [0, 1000],
      [1, 2000],
      [2, 3000],
      [3, 4000],
    ]);
  });

  it('drops fixes that arrive while no hike is recording', async () => {
    const db = await freshDb();
    expect(await saveLocations(db, [fix(1000)])).toBe(0);

    const { id } = await createHike(db, 500);
    await setHikeStatus(db, id, 'paused');
    expect(await saveLocations(db, [fix(2000)])).toBe(0);
    expect(await getTrackPoints(db, id)).toEqual([]);
  });

  it('drops stale fixes from before the hike started', async () => {
    const db = await freshDb();
    const { id } = await createHike(db, 10_000);

    // Android's "last known position", 9 minutes old, arrives with a fresh fix.
    expect(await saveLocations(db, [fix(10_000 - 9 * 60_000), fix(12_000)])).toBe(1);
    expect(await saveLocations(db, [fix(5_000)])).toBe(0);

    const points = await getTrackPoints(db, id);
    expect(points.map((p) => [p.seq, p.recordedAt])).toEqual([[0, 12_000]]);
  });

  it('does nothing for an empty batch', async () => {
    const db = await freshDb();
    await createHike(db);
    expect(await saveLocations(db, [])).toBe(0);
  });
});
