import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { getDb } from '@/db/database';
import { resetFailedHikes, setSyncStatus } from '@/db/hikes';
import { enqueueUnsyncedHikes, getNextAttemptAt, makeAllDue } from '@/db/outbox';
import { getSettings } from '@/db/settings';
import type { Db } from '@/db/types';

import { processOutbox, type UploadHandlers } from './process-outbox';
import { loadSyncCounts, useSyncStatusStore } from './sync-status-store';
import { uploadHike } from './upload-hike';
import { uploadPost } from './upload-post';

/** What uploads each kind of outbox item. */
const HANDLERS: UploadHandlers = {
  // Shows how far the upload has got in the history.
  hike: (db, item) =>
    uploadHike(db, item, (uploadProgress) =>
      useSyncStatusStore.getState().update({ uploadProgress }),
    ),
  post: (db, item) => uploadPost(db, item, () => photosAllowedNow(db)),
};

/**
 * Online means connected with working internet. Android confirms the internet
 * actually works; when a platform can't tell (undefined), trust "connected"
 * and let a failed upload be retried.
 */
export function isOnline(state: Network.NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/** Wi-Fi or a cable: connections that don't use up a mobile data plan. */
export function isUnmetered(state: Network.NetworkState): boolean {
  return (
    state.type === Network.NetworkStateType.WIFI || state.type === Network.NetworkStateType.ETHERNET
  );
}

/** Whether photos may upload on the connection the phone has right now. */
async function photosAllowedNow(db: Db): Promise<boolean> {
  const { photosOnWifiOnly } = await getSettings(db);
  return !photosOnWifiOnly || isUnmetered(await Network.getNetworkStateAsync());
}

let running: Promise<void> | null = null;
let runAgain = false;
let started = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const showStatus = useSyncStatusStore.getState().update;

/** Copies the upload counts to the status store. Never throws: it's only a display. */
async function refreshStatus(): Promise<void> {
  try {
    showStatus(await loadSyncCounts(await getDb()));
  } catch (error) {
    console.warn('Could not read the sync status', error);
  }
}

function clearRetryTimer(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

/**
 * While the app is open, wakes sync up when the next failed item's wait is
 * over, so it's retried on time instead of at the next trigger. (With the app
 * in the background timers pause; returning to the app syncs anyway.)
 */
async function scheduleRetry(): Promise<void> {
  clearRetryTimer();
  if (!started) return;
  const next = await getNextAttemptAt(await getDb());
  // Nothing waiting, or only items no handler can upload yet (already due).
  if (next == null || next <= Date.now()) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    requestSync();
  }, next - Date.now());
}

/**
 * Uploads what's waiting in the outbox, if the phone is online. Safe to call
 * often: while a run is going, calls just ask for one more run afterwards
 * (something may have been queued meanwhile), so only one run is ever active.
 */
export function requestSync(): Promise<void> {
  if (running) {
    runAgain = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        runAgain = false;
        const state = await Network.getNetworkStateAsync();
        const online = isOnline(state);
        showStatus({ online, unmetered: online && isUnmetered(state) });
        if (!online) return;
        await refreshStatus(); // show what's about to upload
        showStatus({ syncing: true });
        const run = await processOutbox(await getDb(), HANDLERS);
        if (__DEV__) console.info('Sync run', run);
        if (run.uploaded > 0) showStatus({ lastUploadAt: Date.now() });
      } while (runAgain);
      await scheduleRetry();
    } catch (error) {
      console.warn('Sync failed', error);
    } finally {
      running = null;
      showStatus({ syncing: false });
      await refreshStatus(); // also when offline, so Home shows what's waiting
    }
  })();
  return running;
}

/**
 * The hiker tapped Retry: put hikes the upload gave up on back in the queue,
 * stop waiting out any backoff, and sync now. A hike the server rejected may
 * be rejected again; then it goes back to 'failed' and Retry shows again.
 */
export async function retryUploads(): Promise<void> {
  const db = await getDb();
  await resetFailedHikes(db);
  await enqueueUnsyncedHikes(db);
  await makeAllDue(db);
  await requestSync();
}

/**
 * The hiker tapped Retry on one failed hike in the history: put just that
 * hike back in the queue and sync now. Like retryUploads, the server may
 * reject it again, and then it goes back to 'failed'.
 */
export async function retryHikeUpload(hikeId: string): Promise<void> {
  const db = await getDb();
  await setSyncStatus(db, hikeId, 'pending');
  // Queues it with no wait (and any other hike whose queuing was missed).
  await enqueueUnsyncedHikes(db);
  await requestSync();
}

/**
 * The signal is back after being lost. An upload that failed meanwhile failed
 * for lack of signal, not because the server is broken, so don't make it sit
 * out its retry wait (up to an hour): make everything due and sync now.
 */
async function syncAfterReconnect(): Promise<void> {
  try {
    await makeAllDue(await getDb());
  } catch (error) {
    console.warn('Could not cut the retry wait short', error);
  }
  await requestSync();
}

/**
 * Starts syncing automatically: now, whenever the internet comes back,
 * whenever the app returns to the foreground, and when a failed item is due
 * to be retried. Returns a function that stops it.
 */
export function startSync(): () => void {
  started = true;
  let wasOnline: boolean | null = null;
  let wasUnmetered = false;
  const network = Network.addNetworkStateListener((state) => {
    const online = isOnline(state);
    const unmetered = online && isUnmetered(state);
    showStatus({ online, unmetered });
    if (online && wasOnline === false)
      void syncAfterReconnect(); // just came back online
    else if (online && wasOnline === null)
      requestSync(); // first check
    else if (unmetered && !wasUnmetered) requestSync(); // onto Wi-Fi: photos may go now
    wasOnline = online;
    wasUnmetered = unmetered;
  });
  const app = AppState.addEventListener('change', (state) => {
    if (state === 'active') requestSync();
  });
  requestSync();

  return () => {
    started = false;
    clearRetryTimer();
    network.remove();
    app.remove();
  };
}
