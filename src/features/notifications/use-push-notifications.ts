import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { api } from '@/api/client';
import { queryClient } from '@/api/query-client';
import { MY_BADGES_KEY, MY_STATS_KEY } from '@/features/achievements/achievements-api';
import { badgeNewsFromPush } from '@/features/achievements/badge-news';
import { checkBadgeNews } from '@/features/achievements/badge-news-check';
import { useBadgeNewsStore } from '@/features/achievements/badge-news-store';

import { notificationTarget } from './notification-rules';
import { ensureChannel, registerPushToken } from './push-token';

// A notification that arrives while the app is open shows as a banner too,
// as it would with the app closed. (On Android, a silent one shows no banner.)
// Except a badge: the app's own banner announces it (see BadgeUnlocks), so
// the phone's would only repeat it.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const show = !badgeNewsFromPush(notification.request.content);
    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show,
      shouldSetBadge: false,
    };
  },
});

/** A badge or level just came in: Profile's level card and badges are out of date. */
function refreshProfileNews() {
  void queryClient.invalidateQueries({ queryKey: MY_STATS_KEY });
  void queryClient.invalidateQueries({ queryKey: MY_BADGES_KEY });
}

function markRead(notificationId: string) {
  api.POST('/api/v1/notifications/read', { body: { ids: [notificationId] } }).catch(() => {}); // offline: it stays unread, nothing else depends on it
}

/**
 * Opens what a tapped notification is about, and marks it read on the
 * server: a badge opens its celebration pop-up, a new level opens Profile.
 */
function openTapped(response: Notifications.NotificationResponse) {
  // Handled once: a later launch mustn't open it again.
  Notifications.clearLastNotificationResponse();
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const content = response.notification.request.content;

  const badge = badgeNewsFromPush(content);
  if (badge) {
    refreshProfileNews();
    useBadgeNewsStore.getState().openFromPush(badge);
    markRead(badge.notificationId);
    return;
  }

  const target = notificationTarget(content.data);
  if (!target) return;
  refreshProfileNews();
  router.navigate(target.href);
  if (target.notificationId) markRead(target.notificationId);
}

/**
 * Push notifications for the signed-in app:
 * - sends this phone's token to the API on launch, and again whenever the
 *   app comes to the front until it has (it may have been offline);
 * - refreshes Profile when a badge or level arrives with the app open (a
 *   badge also gets the app's banner);
 * - opens a tapped badge's pop-up, or Profile for a level, including the tap
 *   that launched the app.
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
      const { content } = notification.request;
      if (badgeNewsFromPush(content)) {
        checkBadgeNews().catch(() => {}); // queues the banner, refreshes Profile
      } else if (notificationTarget(content.data)) {
        refreshProfileNews();
      }
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
