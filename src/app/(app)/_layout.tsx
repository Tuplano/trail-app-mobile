import { router } from 'expo-router';
import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { queueFinishedHikes } from '@/sync/queue-hikes';
import { useRecorderStore } from '@/tracking/recorder-store';

/** The signed-in part of the app. The design's tab bar replaces these tabs in a later task. */
export default function AppLayout() {
  useEffect(() => {
    // If the app was closed or crashed mid-hike, pick that hike back up and
    // show it, so the hiker doesn't land on Home unaware it's still running.
    useRecorderStore
      .getState()
      .restore()
      .then(() => {
        if (useRecorderStore.getState().restored) router.navigate('/record');
      })
      .catch((error: unknown) => console.warn('Could not restore the recording', error))
      // Then queue any finished hike whose upload was never queued (e.g. the
      // app crashed right after Finish, or restore just finished a stale one).
      .finally(queueFinishedHikes);
  }, []);

  return <AppTabs />;
}
