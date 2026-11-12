// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

import { haversineDistance } from './distance';
import type { GpsFix } from './filter';

/**
 * Slower than this, in m/s (1.1 km/h), the hiker has stopped. Low on purpose:
 * a steep climb can be slower than 2 km/h and is still hiking. Standing-still
 * wander is mostly removed by thinPoints before this runs.
 */
export const MIN_MOVING_SPEED_MPS = 0.3;

/**
 * Seconds spent moving: the time between consecutive fixes where the speed
 * between them is at least `minSpeedMps`. Breaks and standing still don't
 * count. Expects fixes in recording order, with bad ones already filtered.
 *
 * The speed comes from the positions, not the phone's own speed reading,
 * which is often missing. GPS drift while standing still can still look like
 * slow movement, so a low threshold may count a little rest as moving.
 */
export function movingTime(
  points: readonly Pick<GpsFix, 'lat' | 'lng' | 'recordedAt'>[],
  minSpeedMps = MIN_MOVING_SPEED_MPS,
): number {
  let seconds = 0;
  for (let i = 1; i < points.length; i++) {
    const elapsedS = (points[i].recordedAt - points[i - 1].recordedAt) / 1000;
    // A repeated or backwards clock gives no time to count.
    if (elapsedS <= 0) continue;
    if (haversineDistance(points[i - 1], points[i]) / elapsedS >= minSpeedMps) {
      seconds += elapsedS;
    }
  }
  return seconds;
}
