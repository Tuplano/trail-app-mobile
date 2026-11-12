// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

import type { HikeFix, HikeStats } from './hike-stats';

// Sample hikes with the numbers computeHikeStats must give for them. The API
// and the app both test against these, so a rule changed on one side only
// (or a copy that wasn't synced) fails a test.

const START = Date.parse('2026-11-01T06:00:00.000Z');
const LAT0 = 16.5;
const LNG0 = 120.9;
/**
 * Meters east/north of the start, as degrees, on a round Earth. On the real
 * (WGS84) Earth a "10 m" step here is about 9.94 m, which the distances show.
 */
const at = (eastM: number, northM: number) => ({
  lat: LAT0 + northM / 111_320,
  lng: LNG0 + eastM / (111_320 * Math.cos((LAT0 * Math.PI) / 180)),
});
const fix = (
  second: number,
  eastM: number,
  northM: number,
  altitudeM: number | null = null,
  accuracyM = 5,
): HikeFix => ({ recordedAt: START + second * 1000, ...at(eastM, northM), altitudeM, accuracyM });

export interface HikeStatsCase {
  name: string;
  fixes: HikeFix[];
  expected: HikeStats;
  /** How many fixes are kept and how many jumps are reported. */
  kept: number;
  jumps: number;
}

export const HIKE_STATS_CASES: HikeStatsCase[] = [
  {
    // 200 m north at 1 m/s, climbing 3 m per fix: 60 m up in 10 m steps.
    name: 'a steady climb',
    fixes: Array.from({ length: 21 }, (_, i) => fix(i * 10, 0, i * 10, 100 + i * 3)),
    expected: {
      distanceM: 198.8213,
      movingTimeS: 200,
      durationS: 200,
      elevationGainM: 60,
      elevationLossM: 0,
      maxAltitudeM: 160,
    },
    kept: 21,
    jumps: 0,
  },
  {
    // 50 m, a 5-minute rest wandering a meter or two, then 50 m more.
    name: 'a rest in the middle',
    fixes: [
      ...Array.from({ length: 6 }, (_, i) => fix(i * 10, 0, i * 10)),
      ...Array.from({ length: 30 }, (_, i) => fix(60 + i * 10, (i % 3) - 1, 50 + ((i * 7) % 5) / 2)),
      ...Array.from({ length: 5 }, (_, i) => fix(370 + i * 10, 0, 60 + i * 10)),
    ],
    expected: {
      distanceM: 99.4109,
      // The rest is one stop, and the last 20 s of walking into it (within
      // 10 m of the stop) are taken into it too: not moving.
      movingTimeS: 70,
      durationS: 410,
      elevationGainM: 0,
      elevationLossM: 0,
      maxAltitudeM: null,
    },
    // The rest (and the walking fixes within 10 m of it) become one stop:
    // two fixes at one spot.
    kept: 9,
    jumps: 0,
  },
  {
    // A walk with one fix 500 m away (an impossible jump) and one too
    // inaccurate to use: both are dropped, the jump is reported.
    name: 'a GPS spike and a bad fix',
    fixes: [
      fix(0, 0, 0, 50),
      fix(10, 0, 10, 50),
      fix(20, 500, 20, 50),
      fix(30, 0, 30, 50, 60),
      fix(40, 0, 40, 50),
      fix(50, 0, 50, 50),
    ],
    expected: {
      distanceM: 49.7053,
      movingTimeS: 50,
      durationS: 50,
      elevationGainM: 0,
      elevationLossM: 0,
      maxAltitudeM: 50,
    },
    kept: 4,
    jumps: 1,
  },
  {
    name: 'no fixes',
    fixes: [],
    expected: {
      distanceM: 0,
      movingTimeS: 0,
      durationS: 0,
      elevationGainM: 0,
      elevationLossM: 0,
      maxAltitudeM: null,
    },
    kept: 0,
    jumps: 0,
  },
];
