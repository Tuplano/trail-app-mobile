import { useRef, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, View } from 'react-native';

import { useColors } from '@/theme/use-colors';

const THUMB = 18;

/**
 * A horizontal slider like the design's range input: a thin track, the part
 * up to the value in the accent color, and a round knob. Touch or drag
 * anywhere on it. Built on React Native's own touch handling, so it needs no
 * extra library.
 *
 * `onChange` gets the raw position; the caller rounds it (e.g. to 50 m).
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
  accessibilityLabel,
  valueText,
}: {
  value: number;
  min: number;
  max: number;
  /** Used by screen readers' swipe up/down. */
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  accessibilityLabel: string;
  valueText?: string;
}) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  // Where the finger first touched (in the slider and on screen), so a drag
  // can be followed by how far the finger moved on screen. locationX alone
  // jumps on Android when the finger leaves the slider.
  const start = useRef({ x: 0, pageX: 0 });

  const usable = Math.max(1, width - THUMB);
  const fraction = Math.min(1, Math.max(0, (value - min) / (max - min)));

  const valueAt = (x: number) => {
    const f = Math.min(1, Math.max(0, (x - THUMB / 2) / usable));
    return min + f * (max - min);
  };
  const grant = (e: GestureResponderEvent) => {
    start.current = { x: e.nativeEvent.locationX, pageX: e.nativeEvent.pageX };
    onChange(valueAt(start.current.x));
  };
  const move = (e: GestureResponderEvent) => {
    onChange(valueAt(start.current.x + e.nativeEvent.pageX - start.current.pageX));
  };

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      // Keep the drag when the finger also moves up or down a little.
      onResponderTerminationRequest={() => false}
      onResponderGrant={grant}
      onResponderMove={move}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        onChange(Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? step : -step))))
      }
      style={[styles.hitArea, disabled && styles.disabled]}>
      {/* As rendered in the design: accent up to the value, light after it. */}
      <View pointerEvents="none" style={[styles.track, { backgroundColor: colors.text2 }]}>
        <View
          style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: colors.accent }]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: fraction * usable,
            backgroundColor: colors.accent,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Taller than it looks, so it's easy to hit.
  hitArea: {
    height: 32,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  track: {
    height: 4,
    marginHorizontal: THUMB / 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  thumb: {
    position: 'absolute',
    top: (32 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
});
