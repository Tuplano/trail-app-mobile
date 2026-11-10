import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { HikeVisibility } from '@/db/hikes';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/** The design's three choices, in its order and words. "Only me" is the API's private. */
export const VISIBILITY_OPTIONS: readonly { value: HikeVisibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'followers', label: 'Followers' },
  { value: 'private', label: 'Only me' },
];

/** "Who can see this": a segmented control, as in the design. */
export function VisibilityPicker({
  value,
  onChange,
  disabled,
}: {
  value: HikeVisibility;
  onChange: (value: HikeVisibility) => void;
  disabled: boolean;
}) {
  const colors = useColors();

  return (
    <View style={styles.block}>
      <Text variant="small" style={styles.label}>
        Who can see this
      </Text>
      <View
        accessibilityRole="radiogroup"
        style={[styles.track, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
        {VISIBILITY_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
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
  block: {
    gap: 8,
  },
  label: {
    fontFamily: fonts.sans[500],
  },
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  option: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
