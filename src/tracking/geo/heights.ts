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
 * time, between their neighbours'. Without the barometer, nothing changes.
 *
 * Expects fixes in recording order. Returns new objects only when heights change.
 */
export function fuseHeights<T extends HeightFix>(
  fixes: readonly T[],
  levelWindowS = LEVEL_WINDOW_S,
): { fixes: T[]; source: HeightSource } {
  const withPressure = fixes.filter((fix) => fix.pressureHpa != null).length;
  if (fixes.length === 0 || withPressure / fixes.length < MIN_PRESSURE_SHARE) {
    return { fixes: [...fixes], source: 'altitude' };
  }

  const baro = fillGaps(
    fixes.map((fix) => fix.recordedAt),
    fixes.map((fix) =>
      fix.pressureHpa == null ? null : pressureToHeightM(fix.pressureHpa),
    ),
  );
  const level = levelOffsets(fixes, baro, levelWindowS);
  return {
    fixes: fixes.map((fix, i) => ({ ...fix, altitudeM: baro[i] + level[i] })),
    source: 'barometer',
  };
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
  fixes: readonly HeightFix[],
  baro: readonly number[],
  windowS: number,
): number[] {
  const halfMs = (windowS / 2) * 1000;
  const sum = [0];
  const count = [0];
  fixes.forEach((fix, i) => {
    const has = fix.altitudeM != null;
    sum.push(sum[i] + (has ? fix.altitudeM! - baro[i] : 0));
    count.push(count[i] + (has ? 1 : 0));
  });

  const offsets: number[] = [];
  let from = 0;
  let to = 0;
  for (let i = 0; i < fixes.length; i++) {
    const t = fixes[i].recordedAt;
    while (fixes[from].recordedAt < t - halfMs) from++;
    while (to + 1 < fixes.length && fixes[to + 1].recordedAt <= t + halfMs)
      to++;
    const n = count[to + 1] - count[from];
    offsets.push(n === 0 ? 0 : (sum[to + 1] - sum[from]) / n);
  }
  return offsets;
}
