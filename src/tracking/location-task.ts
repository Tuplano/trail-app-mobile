import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { getDb } from '@/db/database';

import { useLiveTrackStore } from './live-track-store';
import { saveLocations } from './save-locations';

/** The background task that receives GPS fixes while a hike is recording. */
export const LOCATION_TASK = 'trail-hike-location';

// Must run when this file loads, not inside a component: when Android or iOS
// wakes the app in the background to deliver fixes, no screen is mounted.
// The root layout imports this file so it always loads at startup.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.warn('Location task error', error.message);
      return;
    }
    try {
      const saved = await saveLocations(await getDb(), data?.locations ?? []);
      if (saved > 0) useLiveTrackStore.getState().addPoints(saved);
    } catch (e) {
      console.warn('Could not save GPS points', e);
    }
  },
);

/** Starts GPS. Fixes go to the task above, even with the app in the background. */
export async function startLocationUpdates(): Promise<void> {
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High, // GPS; Highest/BestForNavigation cost more battery
    distanceInterval: 5, // meters between fixes
    timeInterval: 5000, // Android: at most one fix every 5 s
    activityType: Location.ActivityType.Fitness, // iOS: tuned for walking
    pausesUpdatesAutomatically: false, // iOS: don't stop during a long rest
    showsBackgroundLocationIndicator: true, // iOS: blue status bar pill
    // Android: a foreground service keeps GPS alive with the screen locked.
    // It must show a notification while it runs.
    foregroundService: {
      notificationTitle: 'Recording your hike',
      notificationBody: 'Your route is being saved to this phone.',
      killServiceOnDestroy: false, // keep recording if the app is swiped away
    },
  });
}

/** Stops GPS. Safe to call when it isn't running. */
export async function stopLocationUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
