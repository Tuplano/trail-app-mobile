import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { useAuthStore } from '@/features/auth/auth-store';

import { notificationAccess, type NotificationAccess } from './notification-rules';

/** The API's id for this phone's token, kept so signing out can remove it. */
const TOKEN_ID_KEY = 'push.tokenId';

/**
 * Android's channel for the API's pushes. "default" is the one Expo's push
 * service uses when a push names none, which is how the API sends them.
 */
const CHANNEL_ID = 'default';

/** Who this phone's token was sent for since the app started, so it's sent once a run. */
let registeredFor: string | null = null;
/** The registration under way, so two callers share it instead of racing. */
let running: Promise<void> | null = null;

/**
 * Creates the Android channel notifications show in (its name appears in the
 * phone's notification settings). Android 13+ only shows the "Allow
 * notifications" prompt once a channel exists, so this runs before asking.
 */
export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Badges and levels',
    importance: AndroidImportance.DEFAULT,
  });
}

/** Whether notifications are allowed, without asking. */
export async function readNotificationAccess(): Promise<NotificationAccess> {
  return notificationAccess(await Notifications.getPermissionsAsync());
}

/**
 * Shows the phone's "Allow notifications" prompt. If allowed, sends this
 * phone's token to the API straight away (in the background).
 */
export async function askForNotifications(): Promise<NotificationAccess> {
  await ensureChannel();
  const access = notificationAccess(await Notifications.requestPermissionsAsync());
  if (access === 'on') {
    registerPushToken().catch((error: unknown) =>
      console.warn('Could not register for push notifications', error),
    );
  }
  return access;
}

/** The EAS project the push token belongs to (set up by `eas init`). */
function easProjectId(): string | null {
  const fromConfig: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromConfig === 'string') return fromConfig;
  return Constants.easConfig?.projectId ?? null;
}

/**
 * Sends this phone's push token to the API, so it can tell the hiker about
 * badges and levels. Does nothing when signed out, when notifications aren't
 * allowed, or when it already did it for this user since the app started.
 *
 * Throws when it couldn't (offline, the API refused): it's tried again the
 * next time the app comes to the front. Registering the same token twice is
 * fine; the API returns the same entry.
 */
export function registerPushToken(): Promise<void> {
  running ??= register().finally(() => {
    running = null;
  });
  return running;
}

async function register(): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId || registeredFor === userId) return;
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  if ((await readNotificationAccess()) !== 'on') return;

  const projectId = easProjectId();
  if (!projectId) {
    // Expected until the app is linked to an EAS project (task #6): without
    // one, Expo can't issue a push token. Local notifications still work.
    console.log('Push notifications: no EAS project ID yet, so no push token');
    registeredFor = userId; // nothing will change until the next build
    return;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { data, error, response } = await api.POST('/api/v1/push-tokens', {
    body: { token, platform: Platform.OS },
  });
  if (!data) throw toApiError(error, response);
  await SecureStore.setItemAsync(TOKEN_ID_KEY, data.id);
  registeredFor = userId;
}

/**
 * On sign out: asks the API to stop sending pushes to this phone. Takes the
 * access token because sign out clears the session at the same moment. If
 * the call fails (offline), the API still moves the token to whoever signs
 * in next on this phone, and drops it once Expo says the app is gone.
 */
export async function forgetPushToken(accessToken: string | undefined): Promise<void> {
  registeredFor = null;
  const id = await SecureStore.getItemAsync(TOKEN_ID_KEY);
  if (!id) return;
  await SecureStore.deleteItemAsync(TOKEN_ID_KEY);
  if (!accessToken) return;
  await api.DELETE('/api/v1/push-tokens/{id}', {
    params: { path: { id } },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
