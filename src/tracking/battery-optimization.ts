import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

/**
 * Phone makers whose battery savers are known to stop background apps, beyond
 * Android's own battery optimization. See https://dontkillmyapp.com.
 */
export type PhoneBrand = 'xiaomi' | 'samsung' | 'huawei' | 'oneplus' | 'oppo' | 'vivo' | 'other';

/** Works out the phone maker from expo-device's manufacturer/brand strings. */
export function detectBrand(manufacturer: string | null, brand: string | null): PhoneBrand {
  const name = `${manufacturer ?? ''} ${brand ?? ''}`.toLowerCase();
  if (/xiaomi|redmi|poco/.test(name)) return 'xiaomi';
  if (/samsung/.test(name)) return 'samsung';
  if (/huawei|honor/.test(name)) return 'huawei';
  if (/oneplus/.test(name)) return 'oneplus';
  if (/oppo|realme/.test(name)) return 'oppo';
  if (/vivo|iqoo/.test(name)) return 'vivo';
  return 'other';
}

export function currentBrand(): PhoneBrand {
  return detectBrand(Device.manufacturer, Device.brand);
}

/**
 * True when Android limits Trail in the background ("battery optimization"),
 * which can pause GPS during a long hike. Always false on iOS, which has no
 * such setting for apps recording location.
 */
export async function isBatteryOptimized(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return Battery.isBatteryOptimizationEnabledAsync();
}

/**
 * Opens the settings page where the user can stop Android limiting Trail.
 *
 * Xiaomi keeps its own switches (Autostart, Battery saver) on the app's info
 * page, so it opens there. Other phones open Android's "Battery optimization"
 * list, where the user picks Trail → Don't optimize. Both need no special
 * permission (the one-tap "Allow" dialog would need one that Google Play
 * restricts).
 */
export async function openBatterySettings(brand: PhoneBrand = currentBrand()): Promise<void> {
  if (brand === 'xiaomi') {
    await Linking.openSettings();
    return;
  }
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
    );
  } catch {
    // Some phones hide that list; the app's own settings page is the fallback.
    await Linking.openSettings();
  }
}
