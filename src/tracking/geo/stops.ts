// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

import { haversineDistance } from './distance';
import type { GpsFix } from './filter';

/**
 * Fixes that stay within this many meters of where they started count as
 * standing still. GPS wanders a few meters, sometimes 10, around a hiker who
 * isn't moving; walking even slowly leaves this circle within a minute.
 */
export const STOP_RADIUS_M = 10;

/** ...for at least this long. Shorter pauses are left as they are. */
export const STOP_MIN_S = 60;

/**
 * Turns each stop into two fixes at its center: one when it began and one
 * when it ended. A stop is a run of fixes lasting STOP_MIN_S or more that all
 * stay within STOP_RADIUS_M of the run's center. Without this, the GPS
 * wander during a 10-minute rest adds tens of meters that were never walked.
 * Walking is left exactly as it is, so switchbacks and tight turns keep
 * their shape (averaging positions would cut their corners).
 *
 * Expects fixes in recording order with bad ones already filtered out.
 * Returns the same objects for walking, new ones (same other fields) for stops.
 */
export function collapseStops<T extends GpsFix>(
  fixes: readonly T[],
  radiusM = STOP_RADIUS_M,
  minS = STOP_MIN_S,
): T[] {
  const result: T[] = [];
  let i = 0;
  while (i < fixes.length) {
    // Grow a run from fix i while every fix stays near the run's center.
    let lat = fixes[i].lat;
    let lng = fixes[i].lng;
    let j = i;
    while (j + 1 < fixes.length) {
      const next = fixes[j + 1];
      const count = j - i + 2;
      const center = {
        lat: lat + (next.lat - lat) / count,
        lng: lng + (next.lng - lng) / count,
      };
      if (!allWithin(fixes, i, j + 1, center, radiusM)) break;
      lat = center.lat;
      lng = center.lng;
      j++;
    }

    const lastingS = (fixes[j].recordedAt - fixes[i].recordedAt) / 1000;
    if (j > i && lastingS >= minS) {
      result.push({ ...fixes[i], lat, lng }, { ...fixes[j], lat, lng });
      i = j + 1;
    } else {
      result.push(fixes[i]);
      i++;
    }
  }
  return result;
}

/** Whether fixes[from..to] are all within `radiusM` of `center`. */
function allWithin(
  fixes: readonly GpsFix[],
  from: number,
  to: number,
  center: { lat: number; lng: number },
  radiusM: number,
): boolean {
  for (let k = from; k <= to; k++) {
    if (haversineDistance(fixes[k], center) > radiusM) return false;
  }
  return true;
}
