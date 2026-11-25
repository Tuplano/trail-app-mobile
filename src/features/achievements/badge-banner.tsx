import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import type { BadgeNews, NewsDisplay } from './badge-news';
import { BadgeEmblem, Medal } from './medal';

/**
 * The design's unlock banner across the top, styled like a phone
 * notification: the badge's or new rank's emblem, "TRAILING · now",
 * "Badge unlocked: Century" (or "Distance: Gold") and "Your hike synced.
 * Tap to see it."
 */
export function BadgeBanner({
  news,
  display,
  onPress,
}: {
  news: BadgeNews;
  display: NewsDisplay;
  onPress: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${news.title}. Your hike synced.`}
      accessibilityHint={news.kind === 'rank' ? 'Opens the rank' : 'Opens the badge'}
      accessibilityLiveRegion="polite"
      style={({ pressed }) => [
        styles.banner,
        {
          top: insets.top + 8,
          backgroundColor: pressed ? colors.surface : colors.raised,
          borderColor: colors.line3,
        },
      ]}>
      {news.kind === 'rank' ? (
        <Medal rank={news.rank} icon={display.icon} size={40} />
      ) : (
        <BadgeEmblem unlocked icon={display.icon} size={40} />
      )}
      <View style={styles.text}>
        <View style={styles.meta}>
          <Text variant="label" color="muted2">
            TRAILING
          </Text>
          <Text variant="label" color="muted2">
            now
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {news.title}
        </Text>
        <Text variant="small" color="muted" numberOfLines={1}>
          Your hike synced. Tap to see it.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.sans[600],
    fontSize: 14,
    lineHeight: 19,
  },
});
