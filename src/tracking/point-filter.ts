import type { NewTrackPoint } from '@/db/track-points';

import { distanceM } from './geo';

/** Fixes less accurate than this are dropped (e.g. under thick trees, or GPS just waking up). */
export const MAX_ACCURACY_M = 30;

/** Smallest step worth saving. Less than this is GPS wobble, not walking. */
export const MIN_STEP_M = 5;

type Point = Pick<NewTrackPoint, 'lat' | 'lng' | 'accuracyM'>;

/**
 * Keeps only the fixes worth saving, in order:
 *
 * 1. Accuracy: drop a fix whose error margin is over MAX_ACCURACY_M.
 * 2. Distance: drop a fix that is closer to the last kept point than
 *    MIN_STEP_M, or than its own error margin. Standing still, GPS drifts
 *    around by about its accuracy; saving that drift would add distance
 *    the hiker never walked.
 *
 * `last` is the last point already saved for the hike, if any, so a new
 * batch is compared with where the previous one ended.
 */
export function filterPoints<T extends Point>(points: readonly T[], last: Point | null): T[] {
  const kept: T[] = [];
  let previous = last;

  for (const point of points) {
    const accuracy = point.accuracyM ?? null;
    if (accuracy != null && accuracy > MAX_ACCURACY_M) continue;

    if (previous) {
      const minStep = Math.max(MIN_STEP_M, accuracy ?? 0);
      if (distanceM(previous, point) < minStep) continue;
    }

    kept.push(point);
    previous = point;
  }
  return kept;
}
