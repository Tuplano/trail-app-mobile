import { create } from 'zustand';

type LiveTrackState = {
  /** GPS points saved since this hike started (while the app has been running). */
  pointCount: number;
  addPoints: (count: number) => void;
  reset: () => void;
};

/**
 * What the Record screen shows about the track while recording. The database
 * is the real record; this is just a running count for the screen.
 */
export const useLiveTrackStore = create<LiveTrackState>()((set) => ({
  pointCount: 0,
  addPoints: (count) => set((s) => ({ pointCount: s.pointCount + count })),
  reset: () => set({ pointCount: 0 }),
}));
