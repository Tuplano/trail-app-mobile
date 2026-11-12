import { setHikeStats } from '@/db/hikes';
import { getTrackPath, type PathPoint } from '@/db/track-points';
import type { Db } from '@/db/types';

import { computeHikeStats } from './geo/hike-stats';

/**
 * The numbers the Record screen and History show for a hike. They come from
 * the shared rules (src/tracking/geo, copied from the API), the same code
 * the server runs when it processes the hike, so the two agree.
 */
export type HikeStats = {
  /** Fixes saved on the phone (before the rules drop any). */
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

/** Stats for a hike's saved points, in recording order. */
export function computeStats(points: readonly PathPoint[]): HikeStats {
  const { stats } = computeHikeStats(points);
  return {
    pointCount: points.length,
    distanceM: stats.distanceM,
    elevationGainM: stats.elevationGainM,
    movingTimeS: stats.movingTimeS,
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
