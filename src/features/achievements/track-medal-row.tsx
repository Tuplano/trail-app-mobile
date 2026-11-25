import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { Medal } from './medal';
import type { Track } from './progress-api';
import { trackProgress } from './progress-format';

/**
 * Profile's ranks: one medal per track, in the finish of the rank reached,
 * with a ring for the way to the next step. "See all" and each medal open
 * the Achievements screens.
 */
export function TrackMedalRow({ tracks }: { tracks: readonly Track[] }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text variant="subheading">Ranks</Text>
        <Pressable
          onPress={() => router.push('/achievements')}
          accessibilityRole="link"
          hitSlop={10}>
          <Text variant="small" style={{ color: colors.accentText }}>
            See all
          </Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        {tracks.map((track) => {
          const progress = trackProgress(track);
          return (
            <Pressable
              key={track.code}
              onPress={() =>
                router.push({
                  pathname: '/achievements/[track]',
                  params: { track: track.code },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`${track.name}: ${progress.rank}. ${progress.toGo}.`}
              style={({ pressed }) => [styles.cell, pressed && { opacity: 0.7 }]}>
              <Medal
                rank={track.current?.rank?.code ?? null}
                icon={track.icon}
                size={64}
                prestige={track.current?.prestige ?? 0}
                progress={progress.fraction}
              />
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {track.name}
              </Text>
              <Text style={[styles.rank, { color: colors.muted3 }]} numberOfLines={1}>
                {track.current ? track.current.name : '—'}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  name: {
    marginTop: 2,
    fontFamily: fonts.sans[500],
    fontSize: 12,
    lineHeight: 15,
  },
  rank: {
    fontFamily: fonts.sans[400],
    fontSize: 11,
    lineHeight: 14,
  },
});
