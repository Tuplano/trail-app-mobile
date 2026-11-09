import { distanceM } from '../geo';
import { filterPoints, MAX_ACCURACY_M, MIN_STEP_M } from '../point-filter';

// ~1.11 m per 0.00001° of latitude.
const METERS_PER_DEG_LAT = 111_195;
const north = (meters: number, accuracyM: number | null = 5) => ({
  lat: 14.6 + meters / METERS_PER_DEG_LAT,
  lng: 121.0,
  accuracyM,
});

describe('distanceM', () => {
  it('measures meters along the ground', () => {
    expect(distanceM(north(0), north(100))).toBeCloseTo(100, 0);
    // Manila to Baguio: about 205 km in a straight line.
    expect(distanceM({ lat: 14.5995, lng: 120.9842 }, { lat: 16.4023, lng: 120.596 }) / 1000).toBeCloseTo(
      205,
      -1,
    );
    expect(distanceM(north(7), north(7))).toBe(0);
  });
});

describe('filterPoints', () => {
  it('keeps every point of a normal walk', () => {
    const walk = [north(0), north(8), north(16), north(24)];
    expect(filterPoints(walk, null)).toEqual(walk);
  });

  it('drops inaccurate fixes', () => {
    const bad = north(10, MAX_ACCURACY_M + 1);
    const edge = north(40, MAX_ACCURACY_M);
    expect(filterPoints([north(0), bad, edge], null)).toEqual([north(0), edge]);
  });

  it(`drops steps shorter than ${MIN_STEP_M} m (standing still)`, () => {
    const wobble = [north(0), north(1), north(3), north(2), north(4.9), north(6)];
    expect(filterPoints(wobble, null)).toEqual([north(0), north(6)]);
  });

  it("needs a step bigger than the fix's own error margin", () => {
    // 12 m away but only accurate to 20 m: could be wobble, so dropped.
    expect(filterPoints([north(0), north(12, 20), north(25, 20)], null)).toEqual([
      north(0),
      north(25, 20),
    ]);
  });

  it('measures from the last point saved earlier', () => {
    expect(filterPoints([north(102), north(110)], north(100))).toEqual([north(110)]);
  });

  it('keeps fixes with unknown accuracy if they moved far enough', () => {
    expect(filterPoints([north(0, null), north(2, null), north(6, null)], null)).toEqual([
      north(0, null),
      north(6, null),
    ]);
  });
});
