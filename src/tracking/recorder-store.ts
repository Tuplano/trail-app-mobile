import { create } from 'zustand';

/** idle → recording ⇄ paused → finished (→ idle once the hike is saved). */
export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'finished';

const TRANSITIONS: Record<RecorderStatus, readonly RecorderStatus[]> = {
  idle: ['recording'],
  recording: ['paused', 'finished'],
  paused: ['recording', 'finished'],
  finished: ['idle'],
};

export function canTransition(from: RecorderStatus, to: RecorderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

type RecorderState = {
  status: RecorderStatus;
  hikeId: string | null;
  start: (hikeId: string) => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  reset: () => void;
};

/**
 * UI state for the hike recorder. Points and hikes live in SQLite (src/db);
 * this store only tracks which state the recorder is in.
 */
export const useRecorderStore = create<RecorderState>()((set, get) => {
  const moveTo = (to: RecorderStatus, patch: Partial<RecorderState> = {}) => {
    const from = get().status;
    if (!canTransition(from, to)) {
      throw new Error(`Recorder cannot go from ${from} to ${to}`);
    }
    set({ status: to, ...patch });
  };

  return {
    status: 'idle',
    hikeId: null,
    start: (hikeId) => moveTo('recording', { hikeId }),
    pause: () => moveTo('paused'),
    resume: () => moveTo('recording'),
    finish: () => moveTo('finished'),
    reset: () => moveTo('idle', { hikeId: null }),
  };
});
