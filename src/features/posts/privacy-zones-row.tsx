import { StyleSheet, View } from 'react-native';

import { CircleDashed } from '@/components/ui/icons';
import { Toggle } from '@/components/ui/toggle';
import { Text } from '@/components/ui/text';
import { useColors } from '@/theme/use-colors';

/**
 * The design's "Hide track inside privacy zones" switch. Privacy zones come
 * in a later task (#40), so for now it's shown switched off and can't be
 * changed, saying why.
 */
export function PrivacyZonesRow() {
  const colors = useColors();

  return (
    <View
      accessibilityRole="switch"
      accessibilityState={{ checked: false, disabled: true }}
      accessibilityLabel="Hide track inside privacy zones. Coming soon."
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      <CircleDashed size={20} color={colors.accentHi} />
      <View style={styles.text}>
        <Text variant="small" style={styles.title}>
          Hide track inside privacy zones
        </Text>
        <Text variant="label" color="muted2">
          Coming soon · set up zones like Home and Office
        </Text>
      </View>
      <Toggle on={false} disabled />
    </View>
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
