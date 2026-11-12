import { Pressable, StyleSheet } from 'react-native';

import { Check, ShareNetwork } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * Under a hike's details, as in the design: "Share to feed", or once it's
 * shared, "Shared · view in feed" (a hike has one post).
 */
export function ShareButton({
  shared,
  onPress,
  style,
}: {
  shared: boolean;
  onPress: () => void;
  style?: object;
}) {
  const colors = useColors();
  const color = shared ? colors.muted2 : colors.accentText;
  const Icon = shared ? Check : ShareNetwork;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: shared ? colors.line : colors.accent,
          backgroundColor: pressed ? colors.tint : 'transparent',
        },
        style,
      ]}>
      <Icon size={17} color={color} />
      <Text style={[styles.label, { color }]}>
        {shared ? 'Shared · view in feed' : 'Share to feed'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontFamily: fonts.sans[500],
    fontSize: 15,
  },
});
