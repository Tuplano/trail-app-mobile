import { setHikeStats } from '@/db/hikes';
import { getTrackPath, type PathPoint } from '@/db/track-points';
import type { Db } from '@/db/types';

import { distanceM } from './geo';

/**
 * Slower than this between two points counts as resting, not moving
 * (~1 km/h). Points while standing still are already dropped by the filter,
 * so after a rest the next point comes with a long gap and a short step.
 */
export const MIN_MOVING_SPEED_MPS = 0.3;

/**
 * GPS altitude wobbles by 10 m or more. A climb only counts once it rises
 * this far above the last reference height, so wobble doesn't add up to
 * fake climbing. Raise it if field tests show too much gain.
 */
export const ELEVATION_STEP_M = 10;

export type HikeStats = {
  pointCount: number;
  distanceM: number;
  /** Total climbing, in meters. Descents don't subtract. */
  elevationGainM: number;
  /** Time spent moving, in seconds. Rests and pauses aren't included. */
  movingTimeS: number;
};

export const EMPTY_STATS: HikeStats = {
  pointCount: 0,
  distanceM: 0,
  elevationGainM: 0,
  movingTimeS: 0,
};

/** Stats for a hike's points, in recording order. Pure, so it's easy to test. */
export function computeStats(points: readonly PathPoint[]): HikeStats {
  let distance = 0;
  let movingTime = 0;
  let gain = 0;
  let reference: number | null = null; // height climbing is measured from

  points.forEach((point, i) => {
    if (i > 0) {
      const previous = points[i - 1];
      const step = distanceM(previous, point);
      const seconds = (point.recordedAt - previous.recordedAt) / 1000;
      // Across a pause the step is a straight line from where you paused to
      // where you resumed; it counts as distance but not as moving time.
      distance += step;
      if (seconds > 0 && step / seconds >= MIN_MOVING_SPEED_MPS) movingTime += seconds;
    }

    const altitude = point.altitudeM;
    if (altitude == null) return;
    if (reference == null) {
      reference = altitude;
    } else if (altitude - reference >= ELEVATION_STEP_M) {
      gain += altitude - reference; // a real climb
      reference = altitude;
    } else if (reference - altitude >= ELEVATION_STEP_M) {
      reference = altitude; // a real descent: measure the next climb from here
    }
  });

  return {
    pointCount: points.length,
    distanceM: distance,
    elevationGainM: gain,
    movingTimeS: movingTime,
  };
}

/**
 * Recomputes a hike's stats from all its saved points and stores them on the
 * hike. Recomputing (instead of adding to the old numbers) means they can
 * never drift from the points, even after a crash between two writes.
 * Returns the path too, so the live map can draw it without reading it again.
 */
export async function refreshHikeStats(
  db: Db,
  hikeId: string,
): Promise<{ stats: HikeStats; path: PathPoint[] }> {
  const path = await getTrackPath(db, hikeId);
  const stats = computeStats(path);
  await setHikeStats(db, hikeId, stats);
  return { stats, path };
}
