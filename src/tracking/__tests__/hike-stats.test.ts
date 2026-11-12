import fs from 'node:fs';

import { createHike, getHike } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { createTestDb } from '@/db/__tests__/test-db';
import { addTrackPoints, type PathPoint } from '@/db/track-points';

import { HIKE_STATS_CASES } from '../geo/hike-stats.cases';
import { computeStats, EMPTY_STATS, refreshHikeStats } from '../hike-stats';

// The sync script is plain Node; it tells whether the copy matches the API.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sync = require('../../../scripts/sync-geo') as {
  API_GEO: string;
  outdatedFiles: () => string[];
};

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

const METERS_PER_DEG_LAT = 111_195;

/** A point `meters` north of the start, `seconds` in, at `altitude` m. */
const at = (meters: number, seconds: number, altitude: number | null = 100): PathPoint => ({
  recordedAt: seconds * 1000,
  lat: 14.6 + meters / METERS_PER_DEG_LAT,
  lng: 121.0,
  altitudeM: altitude,
  accuracyM: 5,
});

describe('the shared rules (copied from the API)', () => {
  // The same sample hikes the API tests, so the app's copy gives the same numbers.
  it.each(HIKE_STATS_CASES)('$name', ({ fixes, expected }) => {
    const stats = computeStats(fixes as PathPoint[]);
    expect(stats.distanceM).toBeCloseTo(expected.distanceM, 2);
    expect(stats).toMatchObject({
      pointCount: fixes.length,
      movingTimeS: expected.movingTimeS,
      elevationGainM: expected.elevationGainM,
    });
  });

  // Only where the API repo sits next to this one (a developer's machine, not CI).
  const apiHere = fs.existsSync(sync.API_GEO);
  (apiHere ? it : it.skip)('match the API (run npm run sync:geo if this fails)', () => {
    expect(sync.outdatedFiles()).toEqual([]);
  });
});

describe('computeStats', () => {
  it('is empty for no points', () => {
    expect(computeStats([])).toEqual(EMPTY_STATS);
  });

  it('counts every saved fix, even ones the rules leave out', () => {
    // The middle fix is too inaccurate to use, but it was saved.
    const points = [at(0, 0), { ...at(10, 10), accuracyM: 80 }, at(20, 20)];
    const stats = computeStats(points);
    expect(stats.pointCount).toBe(3);
    expect(stats.distanceM).toBeCloseTo(20, 0);
  });
});

describe('refreshHikeStats', () => {
  it('recomputes from the saved points and stores them on the hike', async () => {
    const db = createTestDb();
    await prepareDatabase(db);
    const { id } = await createHike(db);
    await addTrackPoints(db, id, [at(0, 0, 100), at(10, 10, 120), at(20, 20, 140)]);

    const { stats, path } = await refreshHikeStats(db, id);
    expect(stats).toMatchObject({ pointCount: 3, elevationGainM: 40, movingTimeS: 20 });
    expect(path.map((p) => p.altitudeM)).toEqual([100, 120, 140]);
    expect(path.map((p) => p.accuracyM)).toEqual([5, 5, 5]);
    expect(await getHike(db, id)).toMatchObject({
      elevationGainM: 40,
      movingTimeS: 20,
      distanceM: stats.distanceM,
    });
  });
});
