import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CaretRight, CircleDashed, GearSix, MapTrifold } from '@/components/ui/icons';
import { useOfflineAreasStore } from '@/features/offline-maps/offline-areas-store';
import { usePrivacyZones } from '@/features/privacy-zones/privacy-zones-api';
import { SettingsRow } from '@/features/settings/settings-row';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * The design's rows at the bottom of Profile: Offline maps (with how many
 * regions are saved), Privacy zones (how many) and Settings.
 */
export function ProfileLinks() {
  const colors = useColors();
  const regions = useOfflineAreasStore((s) => s.areas.filter((area) => area.complete).length);
  const loaded = useOfflineAreasStore((s) => s.loaded);
  const { data: zones } = usePrivacyZones();
  const caret = <CaretRight size={16} color={colors.faint} />;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      <SettingsRow
        icon={MapTrifold}
        iconColor="accentHi"
        label="Offline maps"
        meta={loaded ? `${regions} ${regions === 1 ? 'region' : 'regions'}` : undefined}
        right={caret}
        onPress={() => router.push('/offline-maps')}
      />
      <SettingsRow
        icon={CircleDashed}
        iconColor="accentHi"
        label="Privacy zones"
        meta={zones ? `${zones.length} ${zones.length === 1 ? 'zone' : 'zones'}` : undefined}
        right={caret}
        onPress={() => router.push('/privacy-zones')}
      />
      <SettingsRow
        icon={GearSix}
        iconColor="accentHi"
        label="Settings"
        right={caret}
        onPress={() => router.push('/settings')}
        last
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
