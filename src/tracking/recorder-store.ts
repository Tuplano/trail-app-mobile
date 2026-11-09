import { create } from 'zustand';

import { getDb } from '@/db/database';
import { createHike, deleteHike, type HikeStatus, setHikeStatus } from '@/db/hikes';

import { useLiveTrackStore } from './live-track-store';
import {
  ensureLocationPermission,
  startLocationUpdates,
  stopLocationUpdates,
} from './location-task';

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
 * Stopping GPS after the hike is already saved as paused/finished. If it fails,
 * nothing is lost: the location task only saves points to a recording hike.
 */
async function stopGpsQuietly(): Promise<void> {
  try {
    await stopLocationUpdates();
  } catch (error) {
    console.warn('Could not stop location updates', error);
  }
}

/**
 * The hike recorder. Every change is saved to SQLite first and only then shown,
 * so the screen never claims a state the database doesn't have. If saving
 * fails, the recorder stays where it was and the action rejects.
 *
 * GPS runs only while recording. The location task saves fixes to whichever
 * hike the database says is recording, so the database decides, not this store.
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

  const currentHikeId = () => {
    const { hikeId } = get();
    if (!hikeId) throw new Error('No hike is being recorded');
    return hikeId;
  };

  return {
    status: 'idle',
    hikeId: null,
    saving: false,

    start: () =>
      moveTo('recording', async () => {
        // Ask first, so a "no" leaves nothing behind.
        await ensureLocationPermission();
        const db = await getDb();
        const hike = await createHike(db);
        try {
          await startLocationUpdates();
        } catch (error) {
          await deleteHike(db, hike.id); // a hike with no GPS is no use
          throw error;
        }
        useLiveTrackStore.getState().reset();
        return { hikeId: hike.id };
      }),

    pause: () =>
      moveTo('paused', async () => {
        await setHikeStatus(await getDb(), currentHikeId(), 'paused');
        await stopGpsQuietly();
        return {};
      }),

    resume: () =>
      moveTo('recording', async () => {
        const hikeId = currentHikeId();
        await ensureLocationPermission(); // it may have been turned off while paused
        await startLocationUpdates();
        try {
          await setHikeStatus(await getDb(), hikeId, 'recording');
        } catch (error) {
          await stopGpsQuietly();
          throw error;
        }
        return {};
      }),

    finish: () =>
      moveTo('finished', async () => {
        await setHikeStatus(await getDb(), currentHikeId(), 'finished');
        await stopGpsQuietly();
        return {};
      }),

    reset: () => {
      const { status } = get();
      if (!canTransition(status, 'idle')) throw new Error(`Recorder cannot go from ${status} to idle`);
      set({ status: 'idle', hikeId: null });
    },
  };
});
