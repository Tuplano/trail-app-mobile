import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  fixLocationAccess,
  getLocationAccess,
  type LocationAccess,
} from '@/tracking/location-permission';

/**
 * The phone's location access for recording, kept fresh: checked on mount and
 * again whenever the app comes back to the foreground (e.g. from Settings).
 * `access` is null until the first check finishes.
 */
export function useLocationAccess() {
  const [access, setAccess] = useState<LocationAccess | null>(null);
  const [fixing, setFixing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await getLocationAccess();
      setAccess(next);
      return next;
    } catch (error) {
      console.warn('Could not check location access', error);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const check = () => {
      getLocationAccess().then(
        (next) => {
          if (mounted) setAccess(next);
        },
        (error: unknown) => console.warn('Could not check location access', error),
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

  /** Runs the next step (a system dialog or Settings) for the current state. */
  const fix = useCallback(async () => {
    if (!access || access === 'ready') return;
    setFixing(true);
    try {
      setAccess(await fixLocationAccess(access));
    } catch (error) {
      console.warn('Could not update location access', error);
    } finally {
      setFixing(false);
    }
  }, [access]);

  return { access, fixing, refresh, fix };
}
