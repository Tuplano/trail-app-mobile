import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { useToggleFollow } from './people-api';

/**
 * Follow / Following, as a pill. The design has no follow button, so it
 * borrows two of its looks: "Follow" is the accent outline of its main
 * buttons, "Following" is the filled tint of the Feed's selected tab.
 * It flips at once; useToggleFollow puts it back if the request fails.
 */
export function FollowButton({
  userId,
  name,
  following,
}: {
  userId: string;
  /** For screen readers: "Follow Maya Okafor". */
  name: string;
  following: boolean;
}) {
  const colors = useColors();
  const toggle = useToggleFollow();

  return (
    <Pressable
      onPress={() => toggle.mutate({ userId, follow: !following })}
      accessibilityRole="button"
      accessibilityLabel={following ? `Unfollow ${name}` : `Follow ${name}`}
      accessibilityState={{ selected: following }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill,
        following
          ? {
              backgroundColor: pressed ? colors.tint2 : colors.tint,
              borderColor: colors.tint,
            }
          : {
              backgroundColor: pressed ? colors.tint2 : 'transparent',
              borderColor: colors.accent,
            },
      ]}>
      <Text style={styles.label} color="accentText">
        {following ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 96,
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.sans[500],
    fontSize: 13,
  },
});
