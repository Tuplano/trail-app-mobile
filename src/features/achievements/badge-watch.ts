import { AppState } from 'react-native';

import { useSyncStatusStore } from '@/sync/sync-status-store';

/**
 * After an upload the server needs a moment to work out badges (a few
 * seconds, longer when busy), so look a few times rather than once.
 */
export const AFTER_UPLOAD_MS = [4000, 12000, 30000];

/**
 * Calls `check` whenever a newly unlocked badge may be waiting: now (launch),
 * whenever the app comes to the front, and a few times after a sync run
 * uploads something. Returns a function that stops watching.
 */
export function watchForBadges(check: () => void): () => void {
  check();
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') check();
  });

  const timers: ReturnType<typeof setTimeout>[] = [];
  const unsubscribe = useSyncStatusStore.subscribe((state, previous) => {
    if (state.lastUploadAt === previous.lastUploadAt) return;
    for (const ms of AFTER_UPLOAD_MS) timers.push(setTimeout(check, ms));
  });

  return () => {
    appState.remove();
    unsubscribe();
    for (const timer of timers) clearTimeout(timer);
  };
}
