import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { queryClient } from '@/api/query-client';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { MY_BADGES_KEY, useMyBadges } from '@/features/achievements/achievements-api';
import { levelProgress } from '@/features/achievements/achievements-format';
import { BadgeGrid } from '@/features/achievements/badge-grid';
import { LevelCard } from '@/features/achievements/level-card';
import { MY_PROGRESS_KEY, useMyProgress } from '@/features/achievements/progress-api';
import { TrackCard } from '@/features/achievements/track-card';
import { UnlockRow } from '@/features/achievements/unlock-row';
import { useColors } from '@/theme/use-colors';

/**
 * Everything you're working towards: your level, each rank track with the
 * way to its next step, your badges, and what you unlocked lately. A track
 * opens its ladder; a recent unlock opens the hike that earned it.
 */
export default function AchievementsScreen() {
  const colors = useColors();
  const progress = useMyProgress();
  const badges = useMyBadges();

  // The server counts a hike a little after it uploads.
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({
        queryKey: MY_PROGRESS_KEY,
        stale: true,
      });
      void queryClient.refetchQueries({ queryKey: MY_BADGES_KEY, stale: true });
    }, []),
  );

  const data = progress.data;

  return (
    <Screen edges={[]} contentStyle={styles.page}>
      <Text variant="title">Achievements</Text>

      {data ? (
        <>
          <LevelCard progress={levelProgress(data)} />

          <View style={styles.section}>
            <Text variant="subheading" style={styles.heading}>
              Ranks
            </Text>
            {data.tracks.map((track) => (
              <TrackCard
                key={track.code}
                track={track}
                onPress={() =>
                  router.push({
                    pathname: '/achievements/[track]',
                    params: { track: track.code },
                  })
                }
              />
            ))}
          </View>
        </>
      ) : progress.isError ? (
        <Text variant="small" color="muted2">
          Your ranks show when you’re back online.
        </Text>
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}

      {badges.data && badges.data.length > 0 ? <BadgeGrid badges={badges.data} /> : null}

      {data && data.recent.length > 0 ? (
        <View style={styles.section}>
          <Text variant="subheading" style={styles.heading}>
            Recently unlocked
          </Text>
          <View>
            {data.recent.map((unlock) => {
              const hikeId = unlock.hikeId;
              return (
                <UnlockRow
                  key={`${unlock.kind}-${unlock.code}-${unlock.step?.step ?? 0}`}
                  unlock={unlock}
                  onPress={
                    hikeId
                      ? () =>
                          router.push({
                            pathname: '/hikes/[id]',
                            params: { id: hikeId },
                          })
                      : undefined
                  }
                />
              );
            })}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  heading: {
    paddingHorizontal: 4,
  },
});
