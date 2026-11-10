import { Image } from 'expo-image';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ChatCircle,
  Clock,
  Heart,
  type IconProps,
  Path,
  Timer,
  TrendUp,
  Warning,
} from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { initials } from '@/features/profile/validation';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { type CarouselPhoto, PhotoCarousel } from './photo-carousel';

export type PostCardProps = {
  postId: string;
  author: { name: string; avatarUrl: string | null };
  /** "Eagle Point north ridge · 3h ago" */
  subtitle: string;
  /** Your own post not on the server yet: "Queued", or "Not posted" if refused. */
  status?: 'queued' | 'failed' | null;
  photos: readonly CarouselPhoto[];
  stats: { distance: string; climb: string; time: string };
  caption: string | null;
  /** Hidden for a post that isn't on the server yet. */
  likes?: { count: number; liked: boolean; onPress: () => void } | null;
  comments?: { count: number; onPress: () => void } | null;
};

/**
 * One post in the feed, as in the design: who and when, the photos, the
 * hike's numbers, the caption, then likes and comments. A queued post is
 * dimmed, as in the design.
 */
export function PostCard({
  postId,
  author,
  subtitle,
  status = null,
  photos,
  stats,
  caption,
  likes = null,
  comments = null,
}: PostCardProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        { borderBottomColor: colors.line2, opacity: status === 'queued' ? 0.72 : 1 },
      ]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
          {author.avatarUrl ? (
            <Image source={{ uri: author.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.initials, { color: colors.accentText }]}>
              {initials(author.name)}
            </Text>
          )}
        </View>
        <View style={styles.headerText}>
          <Text variant="small" style={styles.name} numberOfLines={1}>
            {author.name}
          </Text>
          <Text variant="label" color="muted2" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {status && (
          <View
            style={[
              styles.chip,
              { backgroundColor: status === 'failed' ? colors.errBg : colors.line2 },
            ]}>
            {status === 'failed' ? (
              <Warning size={12} color={colors.err} />
            ) : (
              <Clock size={12} color={colors.text2} />
            )}
            <Text
              style={[
                styles.chipLabel,
                { color: status === 'failed' ? colors.err : colors.text2 },
              ]}>
              {status === 'failed' ? 'Not posted' : 'Queued'}
            </Text>
          </View>
        )}
      </View>

      {photos.length > 0 && <PhotoCarousel photos={photos} postId={postId} />}

      <View style={styles.stats}>
        <Stat icon={Path} value={stats.distance} />
        <Stat icon={TrendUp} value={stats.climb} />
        <Stat icon={Timer} value={stats.time} />
      </View>

      {caption ? <Text style={styles.caption}>{caption}</Text> : null}

      {(likes || comments) && (
        <View style={styles.actions}>
          {likes && (
            <Pressable
              onPress={likes.onPress}
              accessibilityRole="button"
              accessibilityLabel={likes.liked ? 'Unlike' : 'Like'}
              accessibilityState={{ selected: likes.liked }}
              hitSlop={6}
              style={styles.action}>
              <Heart
                size={20}
                weight={likes.liked ? 'fill' : 'regular'}
                color={likes.liked ? colors.accentHi : colors.text2}
              />
              <Text style={[styles.count, { color: likes.liked ? colors.accentHi : colors.text2 }]}>
                {likes.count}
              </Text>
            </Pressable>
          )}
          {comments && (
            <Pressable
              onPress={comments.onPress}
              accessibilityRole="button"
              accessibilityLabel={`Comments, ${comments.count}`}
              hitSlop={6}
              style={styles.action}>
              <ChatCircle size={20} color={colors.text2} />
              <Text style={[styles.count, { color: colors.text2 }]}>{comments.count}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function Stat({ icon: Icon, value }: { icon: ComponentType<IconProps>; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.stat}>
      <Icon size={14} color={colors.accentHi} />
      <Text variant="small" color="text2" style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontFamily: fonts.sans[600],
    fontSize: 13,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.sans[500],
    fontSize: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipLabel: {
    fontFamily: fonts.sans[400],
    fontSize: 11,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 18,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
  },
  caption: {
    paddingHorizontal: 18,
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 14,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 4,
  },
  count: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
});
