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
  return computeTrack(points).stats;
}

/**
 * The stats, and the track as the rules measured it: bad fixes left out,
 * each stop one spot, heights smoothed. That's what the maps and the
 * elevation chart draw, so a rest leaves no squiggle and the chart's climb
 * matches the number.
 */
export function computeTrack(points: readonly PathPoint[]): { stats: HikeStats; path: PathPoint[] } {
  const { stats, kept } = computeHikeStats(points);
  return {
    stats: {
      pointCount: points.length,
      distanceM: stats.distanceM,
      elevationGainM: stats.elevationGainM,
      movingTimeS: stats.movingTimeS,
    },
    path: kept,
  };
}

/**
 * Recomputes a hike's stats from all its saved points and stores them on the
 * hike. Recomputing (instead of adding to the old numbers) means they can
 * never drift from the points, even after a crash between two writes.
 * Returns the measured track too (see computeTrack), for the live map.
 */
export async function refreshHikeStats(
  db: Db,
  hikeId: string,
): Promise<{ stats: HikeStats; path: PathPoint[] }> {
  const track = computeTrack(await getTrackPath(db, hikeId));
  await setHikeStats(db, hikeId, track.stats);
  return track;
}
