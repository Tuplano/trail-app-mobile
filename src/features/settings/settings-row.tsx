import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { IconProps } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import type { ColorName } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * One row of the design's settings list: an icon, a label (and maybe a line
 * under it), and on the right either a short value ("Off · good") or a
 * control such as a switch. A line separates it from the next row.
 */
export function SettingsRow({
  icon: Icon,
  label,
  detail,
  meta,
  right,
  color = 'text',
  iconColor = color,
  onPress,
  disabled = false,
  last = false,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  detail?: string;
  meta?: string;
  right?: ReactNode;
  color?: ColorName;
  /** The icon follows the text unless set, as in the design. */
  iconColor?: ColorName;
  onPress?: () => void;
  disabled?: boolean;
  last?: boolean;
  accessibilityRole?: 'button' | 'switch';
  accessibilityState?: { checked?: boolean; disabled?: boolean };
}) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={({ pressed }) => [
        styles.row,
        detail ? styles.tall : null,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.line2 },
        pressed && { backgroundColor: colors.hover },
      ]}>
      <Icon size={19} color={colors[iconColor]} />
      <View style={styles.text}>
        <Text color={color}>{label}</Text>
        {detail ? (
          <Text variant="label" color="muted2">
            {detail}
          </Text>
        ) : null}
      </View>
      {meta ? (
        <Text variant="small" color="muted2">
          {meta}
        </Text>
      ) : null}
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  tall: {
    minHeight: 56,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
