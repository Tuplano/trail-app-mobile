import { create } from 'zustand';

import type { PathPoint } from '@/db/track-points';

import { EMPTY_STATS, type HikeStats } from './hike-stats';

type LiveTrackState = {
  /** The recording hike's stats, as of the last saved GPS point. */
  stats: HikeStats;
  /** The recording hike's saved points, in order, for the live map. */
  path: PathPoint[];
  update: (stats: HikeStats, path: PathPoint[]) => void;
  reset: () => void;
};

/**
 * What the Record screen shows about the track while recording. The database
 * is the real record (points and stats are saved on the hike); this store just
 * lets the location task hand fresh data to the screen.
 */
export const useLiveTrackStore = create<LiveTrackState>()((set) => ({
  stats: EMPTY_STATS,
  path: [],
  update: (stats, path) => set({ stats, path }),
  reset: () => set({ stats: EMPTY_STATS, path: [] }),
}));
