import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useColors } from '@/theme/use-colors';

/**
 * A setting with two or three choices, as in the design's top card: the
 * name on the left, a small segmented control on the right. `disabled` shows
 * the current choice without letting it change (not built yet).
 */
export function SegmentRow<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
}) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      <Text>{label}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={[styles.track, { backgroundColor: colors.bg, opacity: disabled ? 0.6 : 1 }]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange?.(option.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              style={[styles.option, selected && { backgroundColor: colors.tint }]}>
              <Text variant="small" color={selected ? 'accentText' : 'muted'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  track: {
    width: 150,
    flexDirection: 'row',
    padding: 3,
    borderRadius: 9,
  },
  option: {
    flex: 1,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
