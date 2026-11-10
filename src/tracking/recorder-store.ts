import { create } from 'zustand';

import { getDb } from '@/db/database';
import { createHike, deleteHike, type HikeStatus, setHikeStatus, setHikeTitle } from '@/db/hikes';
import { queueFinishedHikes } from '@/sync/queue-hikes';
import { requestSync } from '@/sync/sync';

import { useLiveTrackStore } from './live-track-store';
import { requireLocationAccess } from './location-permission';
import {
  ensureLocationUpdates,
  startLocationUpdates,
  stopLocationUpdates,
} from './location-task';
import { findHikeToRestore } from './restore-recording';

/** idle → recording ⇄ paused → finished (→ idle once the hike is saved or discarded). */
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
  /** When the hike started and finished (epoch ms), for the elapsed-time clock. */
  startedAt: number | null;
  endedAt: number | null;
  /** True while a change is being saved. Screens disable their buttons meanwhile. */
  saving: boolean;
  /** True when this hike was picked back up after the app restarted. */
  restored: boolean;
  /**
   * Picks up a hike the app was recording when it was closed or crashed.
   * Called when the signed-in app opens; does nothing if a hike is already shown.
   */
  restore: () => Promise<void>;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /**
   * Stops recording. The hike stays on the phone, but isn't queued for upload
   * yet: the hiker names it first, then saves or discards it.
   */
  finish: () => Promise<void>;
  /** Keeps the finished hike under this name (blank: no name) and queues its upload. */
  save: (title: string) => Promise<void>;
  /** Deletes the finished hike and its points. */
  discard: () => Promise<void>;
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
      set({ ...patch, status: to, saving: false, restored: false });
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
    startedAt: null,
    endedAt: null,
    saving: false,
    restored: false,

    restore: async () => {
      const { status, saving } = get();
      if (status !== 'idle' || saving) return; // a hike is already on screen
      set({ saving: true });
      try {
        const db = await getDb();
        const hike = await findHikeToRestore(db);
        if (!hike) {
          await stopGpsQuietly(); // GPS left running with no hike to save to
          return;
        }

        let resumed: HikeStatus = hike.status;
        if (hike.status === 'recording') {
          try {
            await requireLocationAccess();
            await ensureLocationUpdates();
          } catch (error) {
            // GPS can't run (e.g. location was turned off while the app was
            // closed). Say so honestly: pause the hike, and the screen shows
            // how to fix access and Resume.
            console.warn('Could not restart GPS for the restored hike', error);
            await setHikeStatus(db, hike.id, 'paused');
            resumed = 'paused';
          }
        } else {
          await stopGpsQuietly();
        }

        useLiveTrackStore.getState().update(hike.stats, hike.path);
        set({
          status: resumed,
          hikeId: hike.id,
          startedAt: hike.startedAt,
          endedAt: null,
          restored: true,
        });
      } finally {
        set({ saving: false });
      }
    },

    start: () =>
      moveTo('recording', async () => {
        // Check first, so missing access leaves nothing behind. The Record
        // screen walks the user through granting it before Start is shown.
        await requireLocationAccess();
        const db = await getDb();
        const hike = await createHike(db);
        try {
          await startLocationUpdates();
        } catch (error) {
          await deleteHike(db, hike.id); // a hike with no GPS is no use
          throw error;
        }
        useLiveTrackStore.getState().reset();
        return { hikeId: hike.id, startedAt: hike.startedAt, endedAt: null };
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
        await requireLocationAccess(); // it may have been turned off while paused
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
        const endedAt = Date.now();
        await setHikeStatus(await getDb(), currentHikeId(), 'finished', endedAt);
        await stopGpsQuietly();
        // Not queued here: the hike uploads once the hiker taps Save. If the
        // app closes before that, the hike is still saved as finished, and
        // the outbox picks it up (unnamed) when the app opens again.
        return { endedAt };
      }),

    save: (title) =>
      moveTo('idle', async () => {
        const name = title.trim();
        await setHikeTitle(await getDb(), currentHikeId(), name === '' ? null : name);
        await queueFinishedHikes(); // waits in the outbox until sync uploads it
        void requestSync(); // upload now if online; don't make Save wait for it
        useLiveTrackStore.getState().reset();
        return { hikeId: null, startedAt: null, endedAt: null };
      }),

    discard: () =>
      moveTo('idle', async () => {
        // If the outbox already holds it (the app restarted, or Retry queued
        // everything), the upload finds no hike and drops it from the queue.
        await deleteHike(await getDb(), currentHikeId());
        useLiveTrackStore.getState().reset();
        return { hikeId: null, startedAt: null, endedAt: null };
      }),
  };
});
