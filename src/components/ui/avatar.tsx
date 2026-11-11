import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { initials } from '@/features/profile/validation';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { Text } from './text';

/**
 * Someone's round picture, as in the design: their photo, or their initials
 * on the accent tint when they have none.
 */
export function Avatar({
  name,
  url,
  size = 38,
  ring = false,
}: {
  name: string;
  url: string | null;
  size?: number;
  /** The accent ring of the design's big profile picture. */
  ring?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.tint },
        ring && { borderWidth: 1.5, borderColor: colors.accent },
      ]}>
      {url ? (
        <Image source={{ uri: url }} style={styles.image} accessibilityIgnoresInvertColors />
      ) : (
        <Text
          style={{
            fontFamily: fonts.sans[600],
            fontSize: Math.round(size * 0.34),
            color: colors.accentText,
          }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
