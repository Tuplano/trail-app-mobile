import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { getDb } from '@/db/database';
import { getNextAttemptAt } from '@/db/outbox';

import { processOutbox, type UploadHandlers } from './process-outbox';
import { uploadHike } from './upload-hike';

/** What uploads each kind of outbox item. */
const HANDLERS: UploadHandlers = {
  hike: uploadHike,
};

/**
 * Online means connected with working internet. Android confirms the internet
 * actually works; when a platform can't tell (undefined), trust "connected"
 * and let a failed upload be retried.
 */
export function isOnline(state: Network.NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

let running: Promise<void> | null = null;
let runAgain = false;
let started = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

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
        if (!isOnline(await Network.getNetworkStateAsync())) return;
        const run = await processOutbox(await getDb(), HANDLERS);
        if (__DEV__) console.info('Sync run', run);
      } while (runAgain);
      await scheduleRetry();
    } catch (error) {
      console.warn('Sync failed', error);
    } finally {
      running = null;
    }
  })();
  return running;
}

/**
 * Starts syncing automatically: now, whenever the internet comes back,
 * whenever the app returns to the foreground, and when a failed item is due
 * to be retried. Returns a function that stops it.
 */
export function startSync(): () => void {
  started = true;
  let wasOnline: boolean | null = null;
  const network = Network.addNetworkStateListener((state) => {
    const online = isOnline(state);
    if (online && wasOnline !== true) requestSync(); // just came back online
    wasOnline = online;
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
