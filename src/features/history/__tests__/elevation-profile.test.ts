import type { PathPoint } from '@/db/track-points';

import { elevationProfile } from '../elevation-profile';

/** Points heading north, `stepM` meters apart, with the given heights. */
function track(heights: (number | null)[], stepM = 100): PathPoint[] {
  const degreesPerMeter = 1 / 111_195; // along a meridian
  return heights.map((altitudeM, i) => ({
    recordedAt: i * 60_000,
    lat: 14.5 + i * stepM * degreesPerMeter,
    lng: 121,
    altitudeM,
  }));
}

describe('elevationProfile', () => {
  it('scales heights between the lowest and highest point', () => {
    const profile = elevationProfile(track([300, 400, 500]), 3);
    expect(profile).not.toBeNull();
    expect(profile!.minM).toBe(300);
    expect(profile!.maxM).toBe(500);
    // Lowest bar at 18% of the chart, highest at 96%, middle halfway between.
    expect(profile!.bars.map((b) => Math.round(b * 100))).toEqual([18, 57, 96]);
  });

  it('cuts the track by distance, not by number of points', () => {
    // Three points close together at the start, then one far away.
    const points = [
      ...track([100, 100, 100], 1),
      { recordedAt: 0, lat: 14.5 + 1000 / 111_195, lng: 121, altitudeM: 200 },
    ];
    const profile = elevationProfile(points, 4)!;
    // The first quarter holds the three low points; the last holds the high one.
    // The two empty quarters in between repeat the bar before them.
    expect(profile.bars.map((b) => Math.round(b * 100))).toEqual([18, 18, 18, 96]);
  });

  it('skips points without a height', () => {
    const profile = elevationProfile(track([300, null, 500]), 2)!;
    expect(profile.minM).toBe(300);
    expect(profile.maxM).toBe(500);
  });

  it('draws flat ground as level bars', () => {
    const profile = elevationProfile(track([250, 250, 250]), 3)!;
    expect(new Set(profile.bars).size).toBe(1);
  });

  it('spreads a hike that never moved by point order', () => {
    const profile = elevationProfile(track([100, 200], 0), 2)!;
    expect(profile.bars.map((b) => Math.round(b * 100))).toEqual([18, 96]);
  });

  it('is null without at least two heights', () => {
    expect(elevationProfile([])).toBeNull();
    expect(elevationProfile(track([300, null, null]))).toBeNull();
  });

  it('has 40 bars by default, like the design', () => {
    expect(elevationProfile(track([1, 2, 3, 4, 5]))!.bars).toHaveLength(40);
  });
});
