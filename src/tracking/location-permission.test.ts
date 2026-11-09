import * as Location from 'expo-location';
import { Linking } from 'react-native';

import {
  decideLocationAccess,
  fixLocationAccess,
  LocationPermissionError,
  requireLocationAccess,
} from './location-permission';

jest.mock('expo-location', () => ({
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  enableNetworkProviderAsync: jest.fn(),
}));

const loc = jest.mocked(Location);

const granted = { granted: true, canAskAgain: true };
const askable = { granted: false, canAskAgain: true };
const blocked = { granted: false, canAskAgain: false };

describe('decideLocationAccess', () => {
  const decide = (over: Partial<Parameters<typeof decideLocationAccess>[0]>) =>
    decideLocationAccess({
      servicesEnabled: true,
      foreground: granted,
      background: granted,
      ...over,
    });

  it('is ready with precise location allowed all the time', () => {
    expect(decide({})).toBe('ready');
  });

  it('asks to turn location on first', () => {
    expect(decide({ servicesEnabled: false, foreground: blocked })).toBe('services-off');
  });

  it('asks for "while using" before "all the time"', () => {
    expect(decide({ foreground: askable, background: askable })).toBe('ask-foreground');
    expect(decide({ background: askable })).toBe('ask-background');
  });

  it('sends the user to Settings once the OS stops showing the dialog', () => {
    expect(decide({ foreground: blocked })).toBe('foreground-blocked');
    expect(decide({ background: blocked })).toBe('background-blocked');
  });

  it('needs precise location on Android and iOS', () => {
    expect(decide({ foreground: { ...granted, android: { accuracy: 'coarse' } } })).toBe(
      'approximate',
    );
    expect(
      decide({ foreground: { ...granted, ios: { accuracy: 'reduced', scope: 'whenInUse' } } }),
    ).toBe('approximate');
    expect(decide({ foreground: { ...granted, android: { accuracy: 'fine' } } })).toBe('ready');
  });
});

describe('fixLocationAccess', () => {
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    loc.hasServicesEnabledAsync.mockResolvedValue(true);
    loc.getForegroundPermissionsAsync.mockResolvedValue(granted as never);
    loc.getBackgroundPermissionsAsync.mockResolvedValue(granted as never);
  });

  it('shows the right system dialog and returns the new state', async () => {
    expect(await fixLocationAccess('ask-foreground')).toBe('ready');
    expect(loc.requestForegroundPermissionsAsync).toHaveBeenCalled();

    await fixLocationAccess('ask-background');
    expect(loc.requestBackgroundPermissionsAsync).toHaveBeenCalled();
    expect(openSettings).not.toHaveBeenCalled();
  });

  it('opens Settings when the dialog can no longer be shown', async () => {
    await fixLocationAccess('background-blocked');
    await fixLocationAccess('approximate');
    expect(openSettings).toHaveBeenCalledTimes(2);
  });

  it('reports the state after the user says no', async () => {
    loc.getBackgroundPermissionsAsync.mockResolvedValue(blocked as never);
    expect(await fixLocationAccess('ask-background')).toBe('background-blocked');
  });
});

describe('requireLocationAccess', () => {
  it('rejects with the missing step', async () => {
    loc.hasServicesEnabledAsync.mockResolvedValue(true);
    loc.getForegroundPermissionsAsync.mockResolvedValue(askable as never);
    loc.getBackgroundPermissionsAsync.mockResolvedValue(askable as never);

    const error = await requireLocationAccess().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LocationPermissionError);
    expect((error as LocationPermissionError).access).toBe('ask-foreground');
  });
});
