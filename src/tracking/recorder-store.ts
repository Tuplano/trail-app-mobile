import { create } from 'zustand';

import { getDb } from '@/db/database';
import { createHike, type HikeStatus, setHikeStatus } from '@/db/hikes';

/** idle → recording ⇄ paused → finished (→ idle once the hike is saved). */
export type RecorderStatus = 'idle' | HikeStatus;

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
  /** True while a change is being saved. Screens disable their buttons meanwhile. */
  saving: boolean;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<void>;
  /** Back to idle after a finished hike. The hike itself stays saved. */
  reset: () => void;
};

/**
 * The hike recorder. Every change is saved to SQLite first and only then shown,
 * so the screen never claims a state the database doesn't have. If saving
 * fails, the recorder stays where it was and the action rejects.
 */
export const useRecorderStore = create<RecorderState>()((set, get) => {
  async function moveTo(
    to: RecorderStatus,
    save: () => Promise<Partial<RecorderState>>,
  ): Promise<void> {
    const { status, saving } = get();
    // A second tap while the first is still saving (e.g. Start twice) would
    // otherwise create two hikes.
    if (saving) throw new Error('The recorder is still saving the last change');
    if (!canTransition(status, to)) throw new Error(`Recorder cannot go from ${status} to ${to}`);

    set({ saving: true });
    try {
      const patch = await save();
      set({ ...patch, status: to, saving: false });
    } catch (error) {
      set({ saving: false });
      throw error;
    }
  }

  const saveStatus = (to: HikeStatus) => async () => {
    const { hikeId } = get();
    if (!hikeId) throw new Error('No hike is being recorded');
    await setHikeStatus(await getDb(), hikeId, to);
    return {};
  };

  return {
    status: 'idle',
    hikeId: null,
    saving: false,
    start: () =>
      moveTo('recording', async () => {
        const hike = await createHike(await getDb());
        return { hikeId: hike.id };
      }),
    pause: () => moveTo('paused', saveStatus('paused')),
    resume: () => moveTo('recording', saveStatus('recording')),
    finish: () => moveTo('finished', saveStatus('finished')),
    reset: () => {
      const { status } = get();
      if (!canTransition(status, 'idle')) throw new Error(`Recorder cannot go from ${status} to idle`);
      set({ status: 'idle', hikeId: null });
    },
  };
});
