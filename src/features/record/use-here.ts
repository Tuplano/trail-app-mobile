import type { LngLat } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * How often the dot moves: every 2 s and 2 m at most, enough for walking.
 * Never shows Android's "turn on Location Accuracy" dialog: only opening the
 * Record tab shouldn't pop that up.
 */
const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 2000,
  distanceInterval: 2,
  mayShowUserSettingsDialog: false,
};

/**
 * Where the phone is right now, as [longitude, latitude], for the Record
 * map's "you are here" dot. Null until known.
 *
 * It starts from the phone's last known position, so the map has a place to
 * show straight away instead of waiting for a fresh GPS fix, then follows
 * live updates. It only listens while `enabled`, the screen is in view and
 * the app is open, so it costs no battery otherwise (recording has its own
 * background task).
 *
 * Without location permission it stays null; the access card asks for it.
 * When `recheck` changes (pass the access step), it tries again, e.g. right
 * after the hiker allows location.
 */
export function useHere(enabled: boolean, recheck?: unknown): LngLat | null {
  const [here, setHere] = useState<LngLat | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !appActive) return;
      let cancelled = false;
      let watch: Location.LocationSubscription | null = null;
      const take = (position: Location.LocationObject | null) => {
        if (position && !cancelled) {
          setHere([position.coords.longitude, position.coords.latitude]);
        }
      };

      (async () => {
        const { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted || cancelled) return;
        take(await Location.getLastKnownPositionAsync());
        const sub = await Location.watchPositionAsync(WATCH_OPTIONS, take);
        if (cancelled) sub.remove();
        else watch = sub;
      })().catch((error: unknown) => {
        // E.g. location turned off: the map just shows no dot until it's back.
        console.log('Map location unavailable', error);
      });

      return () => {
        cancelled = true;
        watch?.remove();
      };
      // `recheck` isn't read inside: a new value only restarts the listening.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, appActive, recheck]),
  );

  return here;
}
