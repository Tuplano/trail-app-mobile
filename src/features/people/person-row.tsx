import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/auth-store';
import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { FollowButton } from './follow-button';
import { openProfile } from './open-profile';
import type { Person } from './people-cache';

/**
 * One person in a list (search, followers, following): picture, name and
 * @username like a post's author line, and their follow button. Tapping the
 * row opens their profile. You get no button on yourself.
 */
export function PersonRow({
  person,
  first = false,
  last = false,
}: {
  person: Person;
  first?: boolean;
  last?: boolean;
}) {
  const colors = useColors();
  const myId = useAuthStore((s) => s.user?.id);
  const isMe = person.id === myId;

  // Each row is a slice of one rounded card, like the design's Profile and
  // Settings lists: sides on every row, the rounded ends on the first and last.
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line2 },
        first && styles.first,
        last && styles.last,
      ]}>
      <Pressable
        onPress={() => openProfile(person.id, myId)}
        accessibilityRole="link"
        accessibilityLabel={`${person.displayName}, @${person.username}`}
        style={({ pressed }) => [
          styles.row,
          !last && { borderBottomWidth: 1, borderBottomColor: colors.line2 },
          pressed && { backgroundColor: colors.hover },
        ]}>
        <Avatar name={person.displayName} url={person.avatarUrl} />
        <View style={styles.text}>
          <Text variant="small" style={styles.name} numberOfLines={1}>
            {person.displayName}
          </Text>
          <Text variant="label" color="muted2" numberOfLines={1}>
            @{person.username}
            {isMe ? ' · You' : ''}
          </Text>
        </View>
        {!isMe && (
          <FollowButton
            userId={person.id}
            name={person.displayName}
            following={person.isFollowing}
          />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  first: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  last: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.sans[500],
    fontSize: 14,
  },
});
