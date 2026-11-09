import { create } from 'zustand';

import { countFailedHikes } from '@/db/hikes';
import { countWaiting } from '@/db/outbox';
import type { Db } from '@/db/types';

/** What the sync status indicator needs to know. */
export type SyncSnapshot = {
  /** Hikes in the outbox, still to upload. */
  waiting: number;
  /** Of those, how many failed their last try and wait before the next one. */
  backingOff: number;
  /** Hikes the upload gave up on (the server rejected them). */
  failed: number;
  /** A sync run is going right now. */
  syncing: boolean;
  /** Whether the phone has working internet; null until first checked. */
  online: boolean | null;
};

type SyncStatusState = SyncSnapshot & {
  update: (patch: Partial<SyncSnapshot>) => void;
};

export const INITIAL_SYNC_SNAPSHOT: SyncSnapshot = {
  waiting: 0,
  backingOff: 0,
  failed: 0,
  syncing: false,
  online: null,
};

/**
 * How uploads are going, for the screens. The database is the real record
 * (outbox and hikes); sync.ts copies the counts here after each run and when
 * the network changes, so screens don't have to query SQLite themselves.
 */
export const useSyncStatusStore = create<SyncStatusState>()((set) => ({
  ...INITIAL_SYNC_SNAPSHOT,
  update: (patch) => set(patch),
}));

/** Reads the hike upload counts from the database. */
export async function loadSyncCounts(
  db: Db,
  now: number = Date.now(),
): Promise<Pick<SyncSnapshot, 'waiting' | 'backingOff' | 'failed'>> {
  const [{ waiting, backingOff }, failed] = await Promise.all([
    countWaiting(db, 'hike', now),
    countFailedHikes(db),
  ]);
  return { waiting, backingOff, failed };
}
