import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { formatCount } from './people-format';

/**
 * Posts, followers and following in three boxes, in the look of the
 * design's profile stats (HIKES / KM / CLIMB). Followers and following open
 * the list of those people.
 */
export function ProfileCounts({
  userId,
  posts,
  followers,
  following,
}: {
  userId: string;
  posts: number;
  followers: number;
  following: number;
}) {
  const openList = (kind: 'followers' | 'following') => () =>
    router.push({
      pathname: kind === 'followers' ? '/users/[id]/followers' : '/users/[id]/following',
      params: { id: userId },
    });

  return (
    <View style={styles.grid}>
      <CountBox label="POSTS" value={posts} />
      <CountBox label="FOLLOWERS" value={followers} onPress={openList('followers')} />
      <CountBox label="FOLLOWING" value={following} onPress={openList('following')} />
    </View>
  );
}

function CountBox({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${formatCount(value)} ${label.toLowerCase()}`}
      style={({ pressed }) => [
        styles.box,
        { borderColor: colors.line },
        pressed && { backgroundColor: colors.hover },
      ]}>
      <Text style={styles.value}>{formatCount(value)}</Text>
      <Text style={[styles.label, { color: colors.muted2 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  box: {
    flex: 1,
    gap: 3,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  value: {
    fontFamily: fonts.sans[500],
    fontSize: 19,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: fonts.sans[400],
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.66,
  },
});
