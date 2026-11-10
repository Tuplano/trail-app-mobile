import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useColors } from '@/theme/use-colors';

export type FeedTab = 'following' | 'nearby';

const TABS: readonly { value: FeedTab; label: string }[] = [
  { value: 'following', label: 'Following' },
  { value: 'nearby', label: 'Nearby' },
];

/** The design's small "Following / Nearby" switch beside the Feed title. */
export function FeedTabs({
  value,
  onChange,
}: {
  value: FeedTab;
  onChange: (tab: FeedTab) => void;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      {TABS.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, selected && { backgroundColor: colors.tint }]}>
            <Text variant="small" color={selected ? 'accentText' : 'muted2'}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 16,
    borderWidth: 1,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 13,
  },
});
