import { StyleSheet, View } from 'react-native';

import { useColors } from '@/theme/use-colors';

import { Boot } from './icons';
import { Text } from './text';

/** The boot logo and "Trailing" wordmark from the sign-in screen. */
export function BrandMark() {
  const colors = useColors();

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.logo,
          { borderColor: colors.accent, boxShadow: `0 0 24px ${colors.glow}` },
        ]}>
        <Boot size={24} color={colors.accentHi} />
      </View>
      <Text variant="heading" style={styles.wordmark}>
        Trailing
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 20,
  },
});
