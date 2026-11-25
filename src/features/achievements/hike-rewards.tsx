import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatCount } from '@/features/history/hike-summary';
import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { useHikeRewards } from './progress-api';
import { UnlockRow } from './unlock-row';

/**
 * "This hike earned": its xp line by line (walking and climbing, the week's
 * first hike, ranks, badges) and the ranks and badges it reached first.
 * Shown once the hike is uploaded and the server has counted it; nothing
 * before that, offline, or for a hike that earned nothing (a flagged one).
 */
export function HikeRewards({ hikeId, uploaded }: { hikeId: string; uploaded: boolean }) {
  const colors = useColors();
  const rewards = useHikeRewards(hikeId, uploaded);
  const data = rewards.data;
  if (!data || (data.xp === 0 && data.unlocks.length === 0)) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      <View style={styles.top}>
        <Text variant="subheading">This hike earned</Text>
        <Text variant="subheading" style={{ color: colors.accentText }}>
          +{formatCount(data.xp)} XP
        </Text>
      </View>
      <View style={styles.lines}>
        {data.events.map((event, i) => (
          <View key={`${event.kind}-${i}`} style={styles.line}>
            <Text variant="small" color="muted" numberOfLines={1} style={styles.label}>
              {event.label}
            </Text>
            <Text style={[styles.xp, { color: colors.text2 }]}>+{formatCount(event.xp)}</Text>
          </View>
        ))}
      </View>
      {data.unlocks.length > 0 ? (
        <View style={[styles.unlocks, { borderTopColor: colors.line2 }]}>
          {data.unlocks.map((unlock) => (
            <UnlockRow
              key={`${unlock.kind}-${unlock.code}-${unlock.step?.step ?? 0}`}
              unlock={unlock}
              onPress={
                unlock.kind === 'track_step'
                  ? () =>
                      router.push({
                        pathname: '/achievements/[track]',
                        params: { track: unlock.code },
                      })
                  : () => router.push('/achievements')
              }
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  lines: {
    gap: 6,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  label: {
    flex: 1,
  },
  xp: {
    fontFamily: fonts.mono[400],
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  unlocks: {
    paddingTop: 8,
    borderTopWidth: 1,
  },
});
