import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { CaretRight, CircleDashed } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { zonesSummary } from '@/features/privacy-zones/privacy-zones';
import { usePrivacyZones } from '@/features/privacy-zones/privacy-zones-api';
import { useColors } from '@/theme/use-colors';

/**
 * The design's "Hide track inside privacy zones" row. The design has a
 * switch, but the server always hides your zones on every hike and post, so
 * there's nothing to switch: the row says which zones apply and opens the
 * Privacy zones screen (over this one, so the post isn't lost).
 */
export function PrivacyZonesRow({ disabled = false }: { disabled?: boolean }) {
  const colors = useColors();
  const { data: zones } = usePrivacyZones();

  const detail = !zones
    ? 'Always on for all your hikes'
    : zones.length === 0
      ? 'No zones yet · add one around your home'
      : `${zonesSummary(zones.map((zone) => zone.label))} · always on`;

  return (
    <Pressable
      onPress={() => router.push('/privacy-zones')}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Hide track inside privacy zones. ${detail}`}
      accessibilityHint="Opens your privacy zones"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.hover : colors.surface, borderColor: colors.line2 },
      ]}>
      <CircleDashed size={20} color={colors.accentHi} />
      <View style={styles.text}>
        <Text variant="small" style={styles.title}>
          Hide track inside privacy zones
        </Text>
        <Text variant="label" color="muted2" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <CaretRight size={16} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
  },
});
