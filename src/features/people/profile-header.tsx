import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';

/**
 * The top of a profile, as in the design: the big ringed picture, the name,
 * "@maya · 128 followers", and a round or pill button on the right (the
 * gear on yours, Follow on someone else's).
 */
export function ProfileHeader({
  name,
  avatarUrl,
  subtitle,
  right,
  children,
}: {
  name: string;
  avatarUrl: string | null;
  subtitle: string;
  right?: ReactNode;
  /** Extra lines under the subtitle. */
  children?: ReactNode;
}) {
  return (
    <View style={styles.header}>
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
  text: {
    flex: 1,
    gap: 3,
  },
});
