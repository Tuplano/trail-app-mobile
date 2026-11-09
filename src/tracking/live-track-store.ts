import { create } from 'zustand';

import { EMPTY_STATS, type HikeStats } from './hike-stats';

type LiveTrackState = {
  /** The recording hike's stats, as of the last saved GPS point. */
  stats: HikeStats;
  setStats: (stats: HikeStats) => void;
  reset: () => void;
};

/**
 * What the Record screen shows about the track while recording. The database
 * is the real record (stats are saved on the hike); this store just lets the
 * location task hand fresh numbers to the screen.
 */
export const useLiveTrackStore = create<LiveTrackState>()((set) => ({
  stats: EMPTY_STATS,
  setStats: (stats) => set({ stats }),
  reset: () => set({ stats: EMPTY_STATS }),
}));
