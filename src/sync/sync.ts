import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { getDb } from '@/db/database';

import { processOutbox, type UploadHandlers } from './process-outbox';

/**
 * What uploads each kind of outbox item. Empty until task #31 adds the hike
 * upload; until then items wait in the outbox and a sync run skips them.
 */
const HANDLERS: UploadHandlers = {};

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
    } catch (error) {
      console.warn('Sync failed', error);
    } finally {
      running = null;
    }
  })();
  return running;
}

/**
 * Starts syncing automatically: now, whenever the internet comes back, and
 * whenever the app returns to the foreground. Returns a function that stops it.
 */
export function startSync(): () => void {
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
    network.remove();
    app.remove();
  };
}
