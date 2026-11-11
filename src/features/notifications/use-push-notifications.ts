import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { api } from '@/api/client';
import { queryClient } from '@/api/query-client';
import { MY_BADGES_KEY, MY_STATS_KEY } from '@/features/achievements/achievements-api';

import { notificationTarget } from './notification-rules';
import { ensureChannel, registerPushToken } from './push-token';

// A notification that arrives while the app is open shows as a banner too,
// as it would with the app closed. (On Android, a silent one shows no banner.)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** A badge or level just came in: Profile's level card and badges are out of date. */
function refreshProfileNews() {
  void queryClient.invalidateQueries({ queryKey: MY_STATS_KEY });
  void queryClient.invalidateQueries({ queryKey: MY_BADGES_KEY });
}

/** Opens what a tapped notification is about, and marks it read on the server. */
function openTapped(response: Notifications.NotificationResponse) {
  // Handled once: a later launch mustn't open it again.
  Notifications.clearLastNotificationResponse();
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const target = notificationTarget(response.notification.request.content.data);
  if (!target) return;

  refreshProfileNews();
  router.navigate(target.href);
  if (target.notificationId) {
    api
      .POST('/api/v1/notifications/read', { body: { ids: [target.notificationId] } })
      .catch(() => {}); // offline: it stays unread, nothing else depends on it
  }
}

/**
 * Push notifications for the signed-in app:
 * - sends this phone's token to the API on launch, and again whenever the
 *   app comes to the front until it has (it may have been offline);
 * - refreshes Profile when a badge or level arrives with the app open;
 * - opens Profile when one is tapped, including the tap that launched the app.
 */
export function usePushNotifications() {
  useEffect(() => {
    const register = () => {
      registerPushToken().catch((error: unknown) =>
        console.warn('Could not register for push notifications', error),
      );
    };
    ensureChannel()
      .catch((error: unknown) => console.warn('Could not set up notifications', error))
      .finally(register);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') register();
    });

    const received = Notifications.addNotificationReceivedListener((notification) => {
      if (notificationTarget(notification.request.content.data)) refreshProfileNews();
    });

    // The tap that opened the app, if any, then taps while it runs.
    const launchedBy = Notifications.getLastNotificationResponse();
    if (launchedBy) openTapped(launchedBy);
    const tapped = Notifications.addNotificationResponseReceivedListener(openTapped);

    return () => {
      appState.remove();
      received.remove();
      tapped.remove();
    };
  }, []);
}
