import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { Text } from './text';

/**
 * One of the design's outlined number boxes ("34" over "HIKES"). Laid out
 * in rows of three with StatRow. Tappable when given onPress.
 */
export function StatBox({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${value} ${label.toLowerCase()}`}
      style={({ pressed }) => [
        styles.box,
        { borderColor: colors.line },
        pressed && { backgroundColor: colors.hover },
      ]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={[styles.label, { color: colors.muted2 }]}>{label}</Text>
    </Pressable>
  );
}

/** Boxes side by side, sharing the width, as in the design. */
export function StatRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  box: {
    flex: 1,
    gap: 3,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  value: {
    fontFamily: fonts.sans[500],
    fontSize: 19,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: fonts.sans[400],
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.66,
  },
});
