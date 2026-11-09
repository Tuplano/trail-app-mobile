import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { isBatteryOptimized } from '@/tracking/battery-optimization';

/**
 * Whether Android is limiting Trail in the background. Checked on mount and
 * whenever the app comes back to the foreground (e.g. from Settings), so the
 * card disappears as soon as the user has changed it. Null until known.
 */
export function useBatteryOptimization(): boolean | null {
  const [optimized, setOptimized] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = () => {
      isBatteryOptimized().then(
        (next) => {
          if (mounted) setOptimized(next);
        },
        (error: unknown) => console.warn('Could not check battery optimization', error),
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

  return optimized;
}
