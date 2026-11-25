import { Pressable, StyleSheet, View } from 'react-native';

import { CaretRight } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { Medal } from './medal';
import type { Track } from './progress-api';
import { trackProgress } from './progress-format';

/**
 * A track on the Achievements screen: its medal, the rank reached, a bar
 * for the way to the next step ("63 / 150 km"), what's left ("87 km to
 * Gold"). Opens the track's ladder, which shows each step's bonus xp.
 */
export function TrackCard({ track, onPress }: { track: Track; onPress: () => void }) {
  const colors = useColors();
  const progress = trackProgress(track);
  const percent = `${Math.round(progress.fraction * 1000) / 10}%` as const;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${track.name}: ${progress.rank}. ${progress.amount}. ${progress.toGo}.`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.hover : colors.surface,
          borderColor: colors.line2,
        },
      ]}>
      <Medal
        rank={track.current?.rank?.code ?? null}
        icon={track.icon}
        size={56}
        prestige={track.current?.prestige ?? 0}
      />
      <View style={styles.body}>
        <View style={styles.top}>
          <Text variant="subheading" numberOfLines={1} style={styles.flex}>
            {track.name}
          </Text>
          <Text variant="small" style={{ color: colors.accentText }}>
            {progress.rank}
          </Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(progress.fraction * 100),
          }}
          style={[styles.track, { backgroundColor: colors.line }]}>
          <View style={[styles.fill, { width: percent, backgroundColor: colors.accent }]} />
        </View>
        <View style={styles.bottom}>
          <Text style={[styles.amount, { color: colors.muted }]} numberOfLines={1}>
            {progress.amount}
          </Text>
          <Text variant="label" color="muted2" numberOfLines={1} style={styles.toGo}>
            {progress.toGo}
          </Text>
        </View>
      </View>
      <CaretRight size={16} color={colors.muted3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  body: {
    flex: 1,
    gap: 8,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  amount: {
    fontFamily: fonts.mono[400],
    fontSize: 11,
    lineHeight: 15,
  },
  toGo: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
