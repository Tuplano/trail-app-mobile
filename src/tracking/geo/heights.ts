// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

/**
 * Which heights a hike's climb is measured from:
 * - 'barometer': air pressure for the ups and downs, levelled to the fixes'
 *   altitudes (map heights on the server, GPS on the phone);
 * - 'altitude': the fixes' altitudes alone (no barometer, or too few readings).
 */
export type HeightSource = 'barometer' | 'altitude';

/** A fix with what height fusion needs. */
export interface HeightFix {
  /** GPS time in epoch milliseconds. */
  recordedAt: number;
  /** The reference height: map height on the server, GPS on the phone. */
  altitudeM?: number | null;
  /** Air pressure from the phone's barometer, in hPa. */
  pressureHpa?: number | null;
}

/**
 * The barometer is used only if at least this share of fixes have a
 * reading. With fewer, the gaps would be guessed at (a straight line), which
 * hides the ups and downs in them: the altitudes do better.
 */
export const MIN_PRESSURE_SHARE = 0.8;

/**
 * Weather moves air pressure by a few hPa a day (tens of meters of fake
 * height). The barometer's height is pulled toward the reference by its
 * average difference over this many seconds around each fix: slow enough to
 * average out GPS wobble, quick enough to follow a weather change.
 */
export const LEVEL_WINDOW_S = 30 * 60;

/**
 * Lowest and highest air pressure anyone hikes in, in hPa (about Everest's
 * summit to below sea level). Outside that, a reading is a broken sensor.
 */
export const PRESSURE_RANGE_HPA = { min: 250, max: 1100 } as const;

/**
 * Faster than this, up or down, a height change isn't a hiker's: a fast
 * hiker climbs ~0.3 m/s. A reading that would need it is a glitch (a sensor
 * spike, a car's air-con, a GPS height jump) and is left out.
 */
export const MAX_VERTICAL_SPEED_MPS = 2;

/** Room for noise on top of that speed: a barometer wobbles ~1 m, GPS ~10 m or more. */
const PRESSURE_SLACK_M = 5;
const ALTITUDE_SLACK_M = 30;

// After this many left-out readings in a row that agree with each other,
// the last one kept was the wrong one: follow them instead (as filter.ts does).
const RESYNC_AFTER = 5;

/** Pressure at sea level in the standard atmosphere, hPa. */
const SEA_LEVEL_HPA = 1013.25;

/**
 * Height in the standard atmosphere for an air pressure. Off by the day's
 * weather as a level, but its differences are precise: 0.1 hPa is ~1 m.
 */
export function pressureToHeightM(pressureHpa: number): number {
  return 44_330.77 * (1 - (pressureHpa / SEA_LEVEL_HPA) ** 0.190_263);
}

/**
 * The fixes with the heights to measure the climb from, and which source
 * those came from.
 *
 * With the barometer: each fix's height is its pressure height plus the
 * average difference (reference − pressure height) over LEVEL_WINDOW_S
 * around it, so the ups and downs are the barometer's and the level is the
 * reference's. Fixes without a reading get a height in a straight line, in
 * time, between their neighbours'. Without the barometer, the altitudes.
 *
 * Either way, impossible readings are left out first: pressures outside
 * PRESSURE_RANGE_HPA, and pressures or altitudes that would need a climb
 * faster than MAX_VERTICAL_SPEED_MPS (see trustedHeights).
 *
 * Expects fixes in recording order. Returns new objects only when heights change.
 */
export function fuseHeights<T extends HeightFix>(
  fixes: readonly T[],
  levelWindowS = LEVEL_WINDOW_S,
): { fixes: T[]; source: HeightSource } {
  const times = fixes.map((fix) => fix.recordedAt);
  const altitudes = trustedHeights(
    times,
    fixes.map((fix) => fix.altitudeM ?? null),
    ALTITUDE_SLACK_M,
  );
  const pressureHeights = trustedHeights(
    times,
    fixes.map(({ pressureHpa: p }) =>
      p != null && p >= PRESSURE_RANGE_HPA.min && p <= PRESSURE_RANGE_HPA.max
        ? pressureToHeightM(p)
        : null,
    ),
    PRESSURE_SLACK_M,
  );

  const withPressure = pressureHeights.filter((h) => h !== null).length;
  if (fixes.length === 0 || withPressure / fixes.length < MIN_PRESSURE_SHARE) {
    return {
      fixes: fixes.map((fix, i) =>
        altitudes[i] === (fix.altitudeM ?? null)
          ? fix
          : { ...fix, altitudeM: altitudes[i] },
      ),
      source: 'altitude',
    };
  }

  const baro = fillGaps(times, pressureHeights);
  const level = levelOffsets(times, altitudes, baro, levelWindowS);
  return {
    fixes: fixes.map((fix, i) => ({ ...fix, altitudeM: baro[i] + level[i] })),
    source: 'barometer',
  };
}

/**
 * The heights, with each one that would need a climb or drop faster than
 * MAX_VERTICAL_SPEED_MPS (plus `slackM` for noise) since the last one kept
 * set to null. If several in a row are left out but agree with each other,
 * it was the last kept one that was wrong: the track carries on from them.
 */
function trustedHeights(
  times: readonly number[],
  heights: readonly (number | null)[],
  slackM: number,
): (number | null)[] {
  type Reading = { i: number; t: number; h: number };
  const result: (number | null)[] = heights.map(() => null);
  const reachable = (from: Reading, to: Reading) =>
    Math.abs(to.h - from.h) <=
    MAX_VERTICAL_SPEED_MPS * Math.max((to.t - from.t) / 1000, 1) + slackM;

  let anchor: Reading | undefined;
  let stray: Reading[] = [];
  heights.forEach((h, i) => {
    if (h == null) return;
    const reading = { i, t: times[i], h };
    if (!anchor || reachable(anchor, reading)) {
      result[i] = h;
      anchor = reading;
      stray = [];
      return;
    }
    const last = stray.at(-1);
    stray = last && reachable(last, reading) ? [...stray, reading] : [reading];
    if (stray.length >= RESYNC_AFTER) {
      for (const s of stray) result[s.i] = s.h;
      anchor = reading;
      stray = [];
    }
  });
  return result;
}

/**
 * Fills each missing value on a straight line, in time, between the nearest
 * known ones; before the first and after the last, the nearest one. Needs at
 * least one known value.
 */
function fillGaps(
  times: readonly number[],
  values: readonly (number | null)[],
): number[] {
  const known = values.flatMap((value, i) => (value == null ? [] : [i]));
  const filled: number[] = [];
  let next = 0; // index into `known` of the first known value at or after i
  for (let i = 0; i < values.length; i++) {
    while (known[next] < i) next++;
    const after = known[next];
    const before = known[next - 1];
    if (after === i) filled.push(values[i]!);
    else if (before === undefined) filled.push(values[after]!);
    else if (after === undefined) filled.push(values[before]!);
    else {
      const f =
        (times[i] - times[before]) / (times[after] - times[before] || 1);
      filled.push(values[before]! + f * (values[after]! - values[before]!));
    }
  }
  return filled;
}

/**
 * For each fix, the average of (reference − barometer height) over the
 * fixes with a reference within `windowS` / 2 on either side. The
 * window is cut at the hike's ends rather than shrunk, so the first fixes
 * get a steady level too. 0 when no fix has a reference.
 */
function levelOffsets(
  times: readonly number[],
  references: readonly (number | null)[],
  baro: readonly number[],
  windowS: number,
): number[] {
  const halfMs = (windowS / 2) * 1000;
  const sum = [0];
  const count = [0];
  references.forEach((reference, i) => {
    sum.push(sum[i] + (reference === null ? 0 : reference - baro[i]));
    count.push(count[i] + (reference === null ? 0 : 1));
  });

  const offsets: number[] = [];
  let from = 0;
  let to = 0;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    while (times[from] < t - halfMs) from++;
    while (to + 1 < times.length && times[to + 1] <= t + halfMs) to++;
    const n = count[to + 1] - count[from];
    offsets.push(n === 0 ? 0 : (sum[to + 1] - sum[from]) / n);
  }
  return offsets;
}
