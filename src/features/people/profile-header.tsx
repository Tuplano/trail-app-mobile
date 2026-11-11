import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';

/**
 * The top of a profile, as in the design: the big ringed picture, the name,
 * "@maya · 128 followers", and a round or pill button on the right (the
 * gear on yours, Follow on someone else's).
 *
 * With onPress, the picture and name are one button (on yours: Edit profile).
 */
export function ProfileHeader({
  name,
  avatarUrl,
  subtitle,
  right,
  children,
  onPress,
  pressLabel,
}: {
  name: string;
  avatarUrl: string | null;
  subtitle: string;
  right?: ReactNode;
  /** Extra lines under the subtitle. */
  children?: ReactNode;
  onPress?: () => void;
  /** What tapping does, for screen readers, e.g. "Edit profile". */
  pressLabel?: string;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityHint={pressLabel}
        style={({ pressed }) => [styles.who, pressed && styles.pressed]}>
        <Avatar name={name} url={avatarUrl} size={64} ring />
        <View style={styles.text}>
          <Text variant="heading" numberOfLines={2}>
            {name}
          </Text>
          <Text variant="small" color="muted2" numberOfLines={1}>
            {subtitle}
          </Text>
          {children}
        </View>
      </Pressable>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 4,
  },
  // The picture and the words beside it, tappable together.
  who: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    flex: 1,
    gap: 3,
  },
});
