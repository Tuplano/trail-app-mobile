import { getUnfinishedHikes, setHikeStatus } from '@/db/hikes';
import { getLastTrackPoint, getTrackPath, type PathPoint } from '@/db/track-points';
import type { Db } from '@/db/types';

import { computeStats, type HikeStats } from './hike-stats';

/** An unfinished hike found in the database, with what the screen needs. */
export type HikeToRestore = {
  id: string;
  status: 'recording' | 'paused';
  startedAt: number;
  stats: HikeStats;
  path: PathPoint[];
};

/**
 * After the app restarts, finds the hike that was being recorded when it
 * stopped, so the recorder can pick it back up. Null when there is none.
 *
 * Only the newest unfinished hike is resumed. Older ones (left behind by
 * crashes) are finished, ending at their last saved point, so there is never
 * more than one hike in progress.
 */
export async function findHikeToRestore(db: Db): Promise<HikeToRestore | null> {
  const [current, ...stale] = await getUnfinishedHikes(db);
  for (const hike of stale) {
    const last = await getLastTrackPoint(db, hike.id);
    await setHikeStatus(db, hike.id, 'finished', last?.recordedAt ?? hike.startedAt);
  }
  if (!current) return null;

  const path = await getTrackPath(db, current.id);
  return { ...current, stats: computeStats(path), path };
}
