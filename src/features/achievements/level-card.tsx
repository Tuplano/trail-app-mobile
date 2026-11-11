import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import type { LevelProgress } from './achievements-format';

/**
 * The design's level card: "Level 7" and the xp on one line, a glowing
 * accent bar for the way through this level, and what's left to the next.
 */
export function LevelCard({ progress }: { progress: LevelProgress }) {
  const colors = useColors();
  const percent = `${Math.round(progress.fraction * 1000) / 10}%` as const;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      <View style={styles.top}>
        <Text variant="subheading">{progress.title}</Text>
        <Text variant="small" color="muted" style={styles.xp}>
          {progress.xpLabel}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.fraction * 100) }}
        style={[styles.track, { backgroundColor: colors.line }]}>
        <View
          style={[
            styles.fill,
            {
              width: percent,
              backgroundColor: colors.accent,
              boxShadow: `0 0 12px ${colors.accent}`,
            },
          ]}
        />
      </View>
      <Text variant="label" color="muted2">
        {progress.toGo}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  xp: {
    fontFamily: fonts.sans[400],
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
