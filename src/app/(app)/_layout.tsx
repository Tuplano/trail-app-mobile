import { router } from 'expo-router';
import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { useSettingsStore } from '@/features/settings/settings-store';
import { queueFinishedHikes } from '@/sync/queue-hikes';
import { startSync } from '@/sync/sync';
import { useRecorderStore } from '@/tracking/recorder-store';

/**
 * The signed-in part of the app: the bottom tabs (see AppTabs), plus jobs on
 * launch: reading the settings, picking an unfinished hike back up, and
 * starting the upload sync.
 */
export default function AppLayout() {
  useEffect(() => {
    let stopSync: (() => void) | undefined;
    let unmounted = false;

    // The screens' copy of the settings (the defaults show until it's read).
    useSettingsStore
      .getState()
      .load()
      .catch((error: unknown) => console.warn('Could not read the settings', error));

    // If the app was closed or crashed mid-hike, pick that hike back up and
    // show it, so the hiker doesn't land on History unaware it's still running.
    useRecorderStore
      .getState()
      .restore()
      .then(() => {
        if (useRecorderStore.getState().restored) router.navigate('/record');
      })
      .catch((error: unknown) => console.warn('Could not restore the recording', error))
      // Then queue any finished hike whose upload was never queued (e.g. the
      // app crashed right after Finish, or restore just finished a stale one),
      // and start uploading whenever the phone is online.
      .finally(async () => {
        await queueFinishedHikes();
        if (!unmounted) stopSync = startSync();
      });

    // Signing out unmounts this layout: stop syncing (uploads need a session).
    return () => {
      unmounted = true;
      stopSync?.();
    };
  }, []);

  return <AppTabs />;
}
