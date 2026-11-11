import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import type { Badge } from './achievements-api';
import { badgeCountLabel, badgeProgressLabel } from './achievements-format';
import { BadgeIcon } from './badge-icon';

/**
 * The design's badges: "Badges · 6 of 12", then four to a row. An unlocked
 * badge has the accent ring, tint and glow; a locked one is outlined and
 * dim, with how far along it is ("14/50") under its name.
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
      <View
        style={[
          styles.circle,
          unlocked
            ? {
                borderColor: colors.accent,
                backgroundColor: colors.tint,
                boxShadow: `0 0 16px ${colors.glow}`,
              }
            : { borderColor: colors.line },
        ]}>
        <BadgeIcon
          name={badge.icon}
          size={24}
          color={unlocked ? colors.accentText : colors.line3}
        />
      </View>
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
  circle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
