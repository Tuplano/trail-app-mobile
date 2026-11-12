// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

import { haversineDistance } from './distance';
import type { LatLng } from './types';

/**
 * A fix closer than this to the last kept one is treated as the same spot.
 * GPS positions wander by a meter or so from one second to the next; added
 * up along a route, that wander makes it look much longer than it is.
 */
export const MIN_STEP_M = 5;

/**
 * Keeps a fix only once it is at least `minStepM` from the last one kept, or
 * further than the fix's own accuracy if that's worse: a fix that may be 12 m
 * off can't show a 6 m step. So standing still or wander adds no length. The
 * first and last fixes are always kept, so the route still starts and ends
 * where the hike did. Expects fixes in recording order; returns the same objects.
 */
export function thinPoints<T extends LatLng & { accuracyM?: number | null }>(
  points: readonly T[],
  minStepM = MIN_STEP_M,
): T[] {
  const kept: T[] = [];
  for (const point of points) {
    const previous = kept.at(-1);
    const step = Math.max(minStepM, point.accuracyM ?? 0);
    if (!previous || haversineDistance(previous, point) >= step) {
      kept.push(point);
    }
  }
  const end = points.at(-1);
  if (end && kept.at(-1) !== end) kept.push(end);
  return kept;
}
