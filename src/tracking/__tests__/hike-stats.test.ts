import { createHike, getHike } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { createTestDb } from '@/db/__tests__/test-db';
import { addTrackPoints, type PathPoint } from '@/db/track-points';

import {
  computeStats,
  ELEVATION_STEP_M,
  EMPTY_STATS,
  MIN_MOVING_SPEED_MPS,
  refreshHikeStats,
} from '../hike-stats';

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
});

describe('computeStats', () => {
  it('is empty for no points, and for a single point', () => {
    expect(computeStats([])).toEqual(EMPTY_STATS);
    expect(computeStats([at(0, 0)])).toEqual({ ...EMPTY_STATS, pointCount: 1 });
  });

  it('adds up distance and moving time while walking', () => {
    // 1 m/s for 30 s.
    const stats = computeStats([at(0, 0), at(10, 10), at(20, 20), at(30, 30)]);
    expect(stats.pointCount).toBe(4);
    expect(stats.distanceM).toBeCloseTo(30, 0);
    expect(stats.movingTimeS).toBe(30);
  });

  it("doesn't count a rest (or a pause) as moving time", () => {
    // Walk 10 m in 10 s, rest 10 minutes, walk 10 m in 10 s.
    const stats = computeStats([at(0, 0), at(10, 10), at(16, 610), at(26, 620)]);
    expect(6 / 600).toBeLessThan(MIN_MOVING_SPEED_MPS);
    expect(stats.movingTimeS).toBe(20);
    expect(stats.distanceM).toBeCloseTo(26, 0); // the step after the rest still counts
  });

  it('counts real climbs but not GPS altitude wobble', () => {
    const wobble = [100, 108, 93, 104, 96, 101].map((alt, i) => at(i * 10, i * 10, alt));
    expect(computeStats(wobble).elevationGainM).toBe(0);

    // Up 50 m, down 30 m, up 30 m: 80 m of climbing (counted in ≥ step-size rises).
    const hill = [100, 125, 150, 135, 120, 135, 150].map((alt, i) => at(i * 10, i * 10, alt));
    expect(ELEVATION_STEP_M).toBeLessThanOrEqual(15);
    expect(computeStats(hill).elevationGainM).toBe(80);
  });

  it('skips points without an altitude', () => {
    const stats = computeStats([at(0, 0, 100), at(10, 10, null), at(20, 20, 130)]);
    expect(stats.elevationGainM).toBe(30);
  });
});

describe('refreshHikeStats', () => {
  it('recomputes from the saved points and stores them on the hike', async () => {
    const db = createTestDb();
    await prepareDatabase(db);
    const { id } = await createHike(db);
    await addTrackPoints(
      db,
      id,
      [at(0, 0, 100), at(10, 10, 120), at(20, 20, 140)].map((p) => ({ ...p, accuracyM: 5 })),
    );

    const stats = await refreshHikeStats(db, id);
    expect(stats).toMatchObject({ pointCount: 3, elevationGainM: 40, movingTimeS: 20 });
    expect(await getHike(db, id)).toMatchObject({
      elevationGainM: 40,
      movingTimeS: 20,
      distanceM: stats.distanceM,
    });
  });
});
