import { create } from 'zustand';

import type { PathPoint } from '@/db/track-points';

import { EMPTY_STATS, type HikeStats } from './hike-stats';

type LiveTrackState = {
  /** The recording hike's stats, as of the last saved GPS point. */
  stats: HikeStats;
  /** The recording hike's saved points, in order, for the live map. */
  path: PathPoint[];
  /** How accurate the latest GPS fix was, in meters; null until one arrives. */
  accuracyM: number | null;
  update: (stats: HikeStats, path: PathPoint[]) => void;
  setAccuracy: (accuracyM: number | null) => void;
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
  accuracyM: null,
  update: (stats, path) => set({ stats, path }),
  setAccuracy: (accuracyM) => set({ accuracyM }),
  reset: () => set({ stats: EMPTY_STATS, path: [], accuracyM: null }),
}));
