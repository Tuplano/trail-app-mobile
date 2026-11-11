import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import type { Badge } from './achievements-api';
import type { BadgeNews } from './badge-news';
import { BadgeIcon } from './badge-icon';

/**
 * The design's unlock banner across the top, styled like a phone
 * notification: the badge in an outlined tile, "TRAILING · now",
 * "Badge unlocked: Century" and "Your hike synced. Tap to see it."
 */
export function BadgeBanner({
  news,
  badge,
  onPress,
}: {
  news: BadgeNews;
  /** The badge's details, once the badge list has loaded (for its icon). */
  badge: Badge | undefined;
  onPress: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${news.title}. Your hike synced.`}
      accessibilityHint="Opens the badge"
      accessibilityLiveRegion="polite"
      style={({ pressed }) => [
        styles.banner,
        {
          top: insets.top + 8,
          backgroundColor: pressed ? colors.surface : colors.raised,
          borderColor: colors.line3,
        },
      ]}>
      <View style={[styles.tile, { borderColor: colors.accent }]}>
        <BadgeIcon name={badge?.icon ?? ''} size={20} color={colors.accentHi} />
      </View>
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
  tile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
