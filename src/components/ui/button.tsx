import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View } from 'react-native';

import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { Text } from './text';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  /** primary: accent outline with a glow. secondary: plain outline. */
  variant?: 'primary' | 'secondary';
  icon?: ReactNode;
  loading?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  icon,
  loading = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const colors = useColors();
  const primary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      style={(state) => [
        styles.base,
        primary
          ? {
              borderWidth: 1.5,
              borderColor: colors.accent,
              boxShadow: `0 0 22px ${colors.glow}`,
              backgroundColor: state.pressed ? colors.tint2 : 'transparent',
            }
          : {
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: state.pressed ? colors.hover2 : 'transparent',
            },
        inactive && styles.inactive,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={colors.accentText} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            style={[styles.label, primary ? styles.primaryLabel : null]}
            color={primary ? 'accentText' : 'text'}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 15,
  },
  primaryLabel: {
    fontFamily: fonts.sans[500],
    fontSize: 16,
  },
  inactive: {
    opacity: 0.6,
  },
});
