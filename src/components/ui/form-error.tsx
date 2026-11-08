import { StyleSheet, View } from 'react-native';

import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { Text } from './text';

/** A general form message, e.g. "Wrong email or password." */
export function FormError({ message }: { message: string | null }) {
  const colors = useColors();
  if (!message) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: colors.errBg }]}>
      <Text variant="small" color="err">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.input,
  },
});
