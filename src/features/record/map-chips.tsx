import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChartBar, CloudSlash, Crosshair, type IconProps } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { useColors } from '@/theme/use-colors';

type Icon = React.ComponentType<IconProps>;

/** A small see-through label floating on the map, as in the design. */
function Chip({ icon: Icon, children }: { icon: Icon; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.chip, { backgroundColor: colors.glass, borderColor: colors.line }]}>
      <Icon size={14} color={colors.accentHi} />
      <Text variant="label" color="text2">
        {children}
      </Text>
    </View>
  );
}

/**
 * What floats over the Record map: GPS accuracy (once a fix has arrived),
 * "No signal" while offline, and the button that switches to the stats view.
 */
export function MapChips({
  accuracyM,
  offline,
  onShowStats,
}: {
  accuracyM: number | null;
  offline: boolean;
  onShowStats: () => void;
}) {
  const colors = useColors();
  return (
    <>
      <View style={styles.left} pointerEvents="none">
        {accuracyM != null && <Chip icon={Crosshair}>GPS ±{Math.round(accuracyM)} m</Chip>}
        {offline && <Chip icon={CloudSlash}>No signal · saving to phone</Chip>}
      </View>
      <Pressable
        onPress={onShowStats}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.toggle,
          {
            backgroundColor: pressed ? colors.raised : colors.glass,
            borderColor: colors.line,
          },
        ]}>
        <ChartBar size={16} color={colors.accentHi} />
        <Text variant="label" color="text">
          Stats view
        </Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  left: {
    position: 'absolute',
    top: 12,
    left: 14,
    gap: 6,
    alignItems: 'flex-start',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  toggle: {
    position: 'absolute',
    top: 12,
    right: 14,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
});
