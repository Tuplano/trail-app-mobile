import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import type { Badge } from './achievements-api';
import { badgeCountLabel, badgeProgressLabel } from './achievements-format';
import { BadgeEmblem } from './medal';

/**
 * The design's badges: "Badges · 6 of 12", then four to a row. Each is the
 * achievements' hexagon emblem: in the accent once unlocked, a dim dashed
 * outline while locked, with how far along it is ("14/50") under its name.
 */
export function BadgeGrid({ badges }: { badges: readonly Badge[] }) {
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text variant="subheading">Badges</Text>
        <Text variant="small" color="muted2">
          {badgeCountLabel(badges)}
        </Text>
      </View>
      <View style={styles.grid}>
        {badges.map((badge) => (
          <BadgeCell key={badge.code} badge={badge} />
        ))}
      </View>
    </View>
  );
}

function BadgeCell({ badge }: { badge: Badge }) {
  const colors = useColors();
  const unlocked = badge.unlockedAt !== null;
  const progress = badgeProgressLabel(badge);

  return (
    <View
      accessible
      accessibilityLabel={`${badge.name}, ${unlocked ? 'unlocked' : `locked${progress ? `, ${progress}` : ''}`}. ${badge.description}`}
      style={styles.cell}>
      <BadgeEmblem unlocked={unlocked} icon={badge.icon} size={56} />
      <Text style={[styles.name, { color: unlocked ? colors.text : colors.muted3 }]}>
        {badge.name}
      </Text>
      {progress ? (
        <Text style={[styles.progress, { color: colors.muted3 }]}>{progress}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 4,
  },
  // Four columns: each cell a quarter of the row, with room between rows.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
  },
  cell: {
    width: '25%',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  name: {
    fontFamily: fonts.sans[400],
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  progress: {
    fontFamily: fonts.mono[400],
    fontSize: 10,
    lineHeight: 12,
  },
});
