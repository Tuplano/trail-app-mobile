// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

import type { GpsFix } from './filter';

/**
 * Altitudes are averaged over this many seconds (centered). GPS height
 * wobbles by 10 m or more from fix to fix, and a hiker climbs slowly, so
 * averaging over a minute removes the wobble without flattening real climbs.
 * (Positions aren't averaged: that cuts the corners of switchbacks.)
 */
export const ALTITUDE_WINDOW_S = 60;

/**
 * For each fix, the indexes of the fixes within `halfS` seconds on BOTH
 * sides, using the same reach before and after (the smaller of the two
 * gaps to the track's ends). A window that shrinks evenly near the ends
 * leaves the first and last fixes as they are, and a steady climb
 * unchanged, instead of pulling the ends toward the middle.
 */
function windows(
  times: readonly number[],
  halfS: number,
): { from: number; to: number }[] {
  const n = times.length;
  const result: { from: number; to: number }[] = [];
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const reachMs =
      Math.min(halfS * 1000, times[i] - times[0], times[n - 1] - times[i]);
    while (times[lo] < times[i] - reachMs) lo++;
    if (hi < i) hi = i;
    while (hi + 1 < n && times[hi + 1] <= times[i] + reachMs) hi++;
    // The reach shrinks again towards the end, so the far edge can move back.
    while (hi > i && times[hi] > times[i] + reachMs) hi--;
    result.push({ from: lo, to: hi });
  }
  return result;
}

/**
 * Each fix's altitude averaged with its neighbours' over `windowS` seconds,
 * leaving out fixes without one. A fix without an altitude keeps none.
 */
export function smoothAltitudes<T extends GpsFix & { altitudeM?: number | null }>(
  fixes: readonly T[],
  windowS = ALTITUDE_WINDOW_S,
): T[] {
  const spans = windows(
    fixes.map((f) => f.recordedAt),
    windowS / 2,
  );
  const sum = prefixSums(fixes.map((f) => f.altitudeM ?? 0));
  const count = prefixSums(fixes.map((f) => (f.altitudeM == null ? 0 : 1)));
  return fixes.map((fix, i) => {
    if (fix.altitudeM == null) return fix;
    const { from, to } = spans[i];
    const n = count[to + 1] - count[from];
    return { ...fix, altitudeM: (sum[to + 1] - sum[from]) / n };
  });
}

/** sums[k] is the total of the first k values. */
function prefixSums(values: readonly number[]): number[] {
  const sums = [0];
  for (const value of values) sums.push(sums[sums.length - 1] + value);
  return sums;
}
