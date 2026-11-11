import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { NotificationAccess } from './notification-rules';
import { askForNotifications, readNotificationAccess } from './push-token';

/**
 * Whether notifications are allowed (null until known), and a way to ask.
 * Checked again whenever the app comes back to the front, in case they were
 * turned on or off in the phone's Settings.
 */
export function useNotificationAccess() {
  const [access, setAccess] = useState<NotificationAccess | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = () => {
      readNotificationAccess().then(
        (next) => {
          if (mounted) setAccess(next);
        },
        (error: unknown) => console.warn('Could not check notification access', error),
      );
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const ask = () => {
    setAsking(true);
    askForNotifications()
      .then(setAccess)
      .catch((error: unknown) => console.warn('Could not ask for notifications', error))
      .finally(() => setAsking(false));
  };

  return { access, asking, ask };
}
