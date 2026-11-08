import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { type ColorName, fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

const variants = StyleSheet.create({
  display: { fontFamily: fonts.sans[500], fontSize: 32, lineHeight: 35, letterSpacing: -0.8 },
  title: { fontFamily: fonts.sans[500], fontSize: 28, lineHeight: 32, letterSpacing: -0.56 },
  heading: { fontFamily: fonts.sans[500], fontSize: 21, lineHeight: 26, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.sans[500], fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.sans[400], fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sans[600], fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.sans[400], fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fonts.sans[400], fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: fonts.mono[400], fontSize: 11, lineHeight: 14, letterSpacing: 0.88 },
});

export type TextVariant = keyof typeof variants;

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: ColorName;
};

export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  const colors = useColors();
  return <RNText style={[variants[variant], { color: colors[color] }, style]} {...rest} />;
}
