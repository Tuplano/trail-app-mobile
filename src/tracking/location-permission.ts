import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

/**
 * How far the user is from being able to record a hike, as the one next step
 * that's missing. 'ready' means GPS can run with the screen locked.
 */
export type LocationAccess =
  | 'ready'
  /** The phone's location setting is off. */
  | 'services-off'
  /** Never asked, or asked and refused but the OS lets us ask again. */
  | 'ask-foreground'
  /** Refused and the OS won't show the dialog again: only Settings can fix it. */
  | 'foreground-blocked'
  /** Only approximate location was allowed; a route needs precise. */
  | 'approximate'
  /** Allowed while using the app, not "all the time"; can still ask. */
  | 'ask-background'
  /** Background refused and can't be asked again: only Settings can fix it. */
  | 'background-blocked';

type Permission = Pick<
  Location.LocationPermissionResponse,
  'granted' | 'canAskAgain' | 'android' | 'ios'
>;

/** Picks the next missing step. Kept pure so every case can be tested. */
export function decideLocationAccess(state: {
  servicesEnabled: boolean;
  foreground: Permission;
  background: Permission;
}): LocationAccess {
  const { servicesEnabled, foreground, background } = state;
  if (!servicesEnabled) return 'services-off';
  if (!foreground.granted) return foreground.canAskAgain ? 'ask-foreground' : 'foreground-blocked';
  if (foreground.android?.accuracy === 'coarse' || foreground.ios?.accuracy === 'reduced') {
    return 'approximate';
  }
  if (!background.granted) return background.canAskAgain ? 'ask-background' : 'background-blocked';
  return 'ready';
}

/** Reads the current state without showing anything to the user. */
export async function getLocationAccess(): Promise<LocationAccess> {
  const [servicesEnabled, foreground, background] = await Promise.all([
    Location.hasServicesEnabledAsync(),
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return decideLocationAccess({ servicesEnabled, foreground, background });
}

/**
 * Takes the one action that fixes `access` (a system dialog, or the app's
 * page in Settings), then returns the new state. Settings changes are also
 * picked up when the app comes back to the foreground.
 */
export async function fixLocationAccess(access: LocationAccess): Promise<LocationAccess> {
  switch (access) {
    case 'ask-foreground':
      await Location.requestForegroundPermissionsAsync();
      break;
    case 'ask-background':
      // Android 11+ opens the app's location page in Settings for this.
      await Location.requestBackgroundPermissionsAsync();
      break;
    case 'services-off':
      if (Platform.OS === 'android') {
        // Google Play's "Turn on location?" dialog. Rejects if the user says no.
        await Location.enableNetworkProviderAsync().catch(() => {});
      } else {
        await Linking.openSettings();
      }
      break;
    case 'foreground-blocked':
    case 'background-blocked':
    case 'approximate':
      await Linking.openSettings();
      break;
    case 'ready':
      break;
  }
  return getLocationAccess();
}

/** Thrown when recording is asked to start without full location access. */
export class LocationPermissionError extends Error {
  constructor(readonly access: LocationAccess) {
    super(`Location access is not ready: ${access}`);
    this.name = 'LocationPermissionError';
  }
}

/** Guard for the recorder: rejects unless GPS can run with the screen locked. */
export async function requireLocationAccess(): Promise<void> {
  const access = await getLocationAccess();
  if (access !== 'ready') throw new LocationPermissionError(access);
}
