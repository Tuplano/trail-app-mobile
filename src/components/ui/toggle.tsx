import { StyleSheet, View } from 'react-native';

import { useColors } from '@/theme/use-colors';

/**
 * The design's on/off switch (40×24, a white knob). Only the picture: the
 * row around it is what's pressed, so the whole row is the target.
 */
export function Toggle({ on, disabled = false }: { on: boolean; disabled?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.track,
        { backgroundColor: on ? colors.accent : colors.line, opacity: disabled ? 0.5 : 1 },
      ]}>
      <View style={[styles.knob, { backgroundColor: colors.knob }, on && styles.knobOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 40,
    height: 24,
    borderRadius: 12,
    padding: 3,
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  knobOn: {
    transform: [{ translateX: 16 }],
  },
});
