import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { FormError } from '@/components/ui/form-error';
import { BatteryCharging, CircleDashed, SignOut, Trash, WifiHigh } from '@/components/ui/icons';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Toggle } from '@/components/ui/toggle';
import { signOut } from '@/features/auth/auth-api';
import { usePrivacyZones } from '@/features/privacy-zones/privacy-zones-api';
import { useBatteryOptimization } from '@/features/record/use-battery-optimization';
import { SegmentRow } from '@/features/settings/segment-row';
import { SettingsRow } from '@/features/settings/settings-row';
import { useSettingsStore } from '@/features/settings/settings-store';
import { openBatterySettings } from '@/tracking/battery-optimization';
import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * Settings, laid out as in the design. Working now: photos on Wi-Fi only,
 * privacy zones, battery optimization (Android) and sign out. The rest show their current
 * value until their tasks are built.
 */
export default function SettingsScreen() {
  const colors = useColors();
  const photosOnWifiOnly = useSettingsStore((s) => s.settings.photosOnWifiOnly);
  const change = useSettingsStore((s) => s.change);
  const batteryOptimized = useBatteryOptimization();
  const { data: zones } = usePrivacyZones();
  const [error, setError] = useState<string | null>(null);

  const toggleWifiOnly = () => {
    setError(null);
    change('photosOnWifiOnly', !photosOnWifiOnly).catch((e: unknown) => {
      console.warn('Could not save the setting', e);
      setError("Couldn't save that setting. Please try again.");
    });
  };

  const openBattery = () => {
    openBatterySettings().catch((e: unknown) => console.warn('Could not open battery settings', e));
  };

  const card = { backgroundColor: colors.surface, borderColor: colors.line2 };
  const version = Constants.expoConfig?.version ?? '';

  return (
    // The header (with the back button) sits under the status bar already.
    <Screen edges={[]} contentStyle={styles.page}>
      <Text variant="title">Settings</Text>

      <View style={styles.choicesBlock}>
        <View style={[styles.card, styles.choices, card]}>
          <SegmentRow
            label="Units"
            value="km"
            options={[
              { value: 'km', label: 'km' },
              { value: 'mi', label: 'mi' },
            ]}
            disabled
          />
          <SegmentRow
            label="Appearance"
            value="dark"
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            disabled
          />
          <SegmentRow
            label="Recorder"
            value="map"
            options={[
              { value: 'map', label: 'Map' },
              { value: 'stats', label: 'Stats' },
            ]}
            disabled
          />
        </View>
        <Text variant="label" color="muted2" style={styles.aside}>
          Coming soon: miles, the light theme, and opening Record on the stats view.
        </Text>
      </View>

      <View style={[styles.card, styles.list, card]}>
        <SettingsRow
          icon={WifiHigh}
          iconColor="accentHi"
          label="Upload photos on Wi-Fi only"
          detail="Hikes always upload on any connection"
          right={<Toggle on={photosOnWifiOnly} />}
          onPress={toggleWifiOnly}
          accessibilityRole="switch"
          accessibilityState={{ checked: photosOnWifiOnly }}
        />
        <SettingsRow
          icon={CircleDashed}
          label="Privacy zones"
          meta={zones ? `${zones.length}` : undefined}
          onPress={() => router.push('/privacy-zones')}
        />
        {Platform.OS === 'android' && (
          <SettingsRow
            icon={BatteryCharging}
            label="Battery optimization"
            meta={batteryOptimized === null ? '' : batteryOptimized ? 'On' : 'Off · good'}
            onPress={openBattery}
          />
        )}
        <SettingsRow icon={SignOut} label="Sign out" onPress={signOut} />
        <SettingsRow
          icon={Trash}
          label="Delete account"
          color="err"
          meta="Coming soon"
          disabled
          last
        />
      </View>
      <FormError message={error} />

      <Text style={[styles.version, { color: colors.faint }]}>
        TRAILING {version} · {Platform.OS.toUpperCase()}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 18,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
  },
  choicesBlock: {
    gap: 8,
  },
  choices: {
    gap: 14,
    padding: 16,
  },
  aside: {
    paddingHorizontal: 4,
  },
  list: {
    overflow: 'hidden',
  },
  version: {
    fontFamily: fonts.mono[400],
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: 4,
  },
});
