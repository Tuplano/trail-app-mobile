import { create } from 'zustand';

import { countFailedHikes } from '@/db/hikes';
import { countWaiting } from '@/db/outbox';
import type { Db } from '@/db/types';

/** How far the hike being uploaded has got: points the server has, of all its points. */
export type UploadProgress = { hikeId: string; sent: number; total: number };

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
  /** On Wi-Fi or a cable (photos may upload with Wi-Fi only on); null until first checked. */
  unmetered: boolean | null;
  /** The hike uploading right now and how far it has got; null between uploads. */
  uploadProgress: UploadProgress | null;
  /**
   * When a sync run last uploaded something (epoch ms); null until one does.
   * The server works out badges a little after a hike arrives, so the badge
   * banner looks for new ones after this changes.
   */
  lastUploadAt: number | null;
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
  unmetered: null,
  uploadProgress: null,
  lastUploadAt: null,
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
