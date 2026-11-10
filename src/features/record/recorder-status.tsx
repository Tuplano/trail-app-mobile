import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { RecorderStatus } from '@/tracking/recorder-store';
import { useColors } from '@/theme/use-colors';

/**
 * What the status line says. The design's "Ready · GPS locked" isn't used:
 * GPS only runs while recording, so before Start there's no fix to lock.
 */
export const RECORDER_LABELS: Record<RecorderStatus, string> = {
  idle: 'Ready',
  recording: 'Recording',
  paused: 'Paused',
  finished: 'Finished',
};

/** A dot (pulsing while recording) and the recorder's state, as in the design. */
export function RecorderStatusLine({ status }: { status: RecorderStatus }) {
  const colors = useColors();
  const live = status === 'recording';
  // One animated value for the component's life (state, not a ref: it's read while rendering).
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!live) {
      opacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [live, opacity]);

  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <Animated.View
        style={[styles.dot, { opacity, backgroundColor: live ? colors.accent : colors.faint }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text variant="small" color="text2">
        {RECORDER_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
