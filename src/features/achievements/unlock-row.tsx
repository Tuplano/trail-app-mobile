import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/text';
import { useColors } from '@/theme/use-colors';

import { BadgeEmblem, Medal } from './medal';
import type { Unlock } from './progress-api';
import { formatUnlockDate } from './progress-format';

/**
 * Something unlocked, in a list: a rank step shows its medal, a badge its
 * emblem in the accent. With `onPress`, it opens the hike that earned it.
 */
export function UnlockRow({ unlock, onPress }: { unlock: Unlock; onPress?: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${unlock.name}, ${formatUnlockDate(unlock.unlockedAt)}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.hover }]}>
      {unlock.step ? (
        <Medal
          rank={unlock.step.rank?.code ?? null}
          icon={unlock.icon}
          size={38}
          prestige={unlock.step.prestige}
        />
      ) : (
        <BadgeEmblem unlocked icon={unlock.icon} size={38} />
      )}
      <Text variant="small" numberOfLines={1} style={styles.name}>
        {unlock.name}
      </Text>
      <Text variant="label" color="muted2">
        {formatUnlockDate(unlock.unlockedAt)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  name: {
    flex: 1,
  },
});
