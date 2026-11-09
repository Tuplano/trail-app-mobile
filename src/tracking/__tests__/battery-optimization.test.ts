import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

import { detectBrand, isBatteryOptimized, openBatterySettings } from '../battery-optimization';

jest.mock('expo-battery', () => ({ isBatteryOptimizationEnabledAsync: jest.fn() }));
jest.mock('expo-device', () => ({ manufacturer: 'Xiaomi', brand: 'Redmi' }));
jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(),
  ActivityAction: {
    IGNORE_BATTERY_OPTIMIZATION_SETTINGS: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
  },
}));

const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
const startActivity = jest.mocked(IntentLauncher.startActivityAsync);

beforeEach(() => jest.clearAllMocks());

describe('detectBrand', () => {
  it.each([
    ['Xiaomi', 'Redmi', 'xiaomi'],
    ['Xiaomi', 'POCO', 'xiaomi'],
    ['samsung', 'samsung', 'samsung'],
    ['HUAWEI', 'HONOR', 'huawei'],
    ['OnePlus', 'OnePlus', 'oneplus'],
    ['realme', 'realme', 'oppo'],
    ['vivo', 'iQOO', 'vivo'],
    ['Google', 'google', 'other'],
    [null, null, 'other'],
  ] as const)('%s / %s → %s', (manufacturer, brand, expected) => {
    expect(detectBrand(manufacturer, brand)).toBe(expected);
  });
});

describe('isBatteryOptimized', () => {
  const os = Platform.OS;
  afterEach(() => {
    Platform.OS = os;
  });

  it("asks Android, and is always false on iOS", async () => {
    Platform.OS = 'android';
    jest.mocked(Battery.isBatteryOptimizationEnabledAsync).mockResolvedValue(true);
    expect(await isBatteryOptimized()).toBe(true);

    Platform.OS = 'ios';
    expect(await isBatteryOptimized()).toBe(false);
  });
});

describe('openBatterySettings', () => {
  it("opens Trail's app info on Xiaomi, where Autostart and Battery saver live", async () => {
    await openBatterySettings('xiaomi');
    expect(openSettings).toHaveBeenCalled();
    expect(startActivity).not.toHaveBeenCalled();
  });

  it("opens Android's battery optimization list on other phones", async () => {
    await openBatterySettings('samsung');
    expect(startActivity).toHaveBeenCalledWith(
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
    );
    expect(openSettings).not.toHaveBeenCalled();
  });

  it("falls back to Trail's app info if the list can't open", async () => {
    startActivity.mockRejectedValueOnce(new Error('No activity'));
    await openBatterySettings('other');
    expect(openSettings).toHaveBeenCalled();
  });
});
