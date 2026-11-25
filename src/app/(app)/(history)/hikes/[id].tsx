import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { HikeRewards } from '@/features/achievements/hike-rewards';
import { ElevationChart } from '@/features/history/elevation-chart';
import { HikeStatsGrid } from '@/features/history/hike-stats-grid';
import { ExportGpxButton } from '@/features/gpx/export-button';
import { formatHikeDate, hikeTitle, statsNote } from '@/features/history/hike-summary';
import { useHikeDetail } from '@/features/history/use-hikes';
import { ShareButton } from '@/features/posts/share-button';
import { LiveTrackMap } from '@/features/record/live-track-map';
import { useColors } from '@/theme/use-colors';

/**
 * One finished hike: its route, stats and elevation, read from the phone,
 * and buttons to share it to the feed or export it as a GPX file. Its numbers
 * are the server's final ones once sync has saved them (see sync/server-stats).
 */
export default function HikeDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useHikeDetail(id);

  if (detail.state !== 'ready') {
    return (
      <Screen edges={[]} contentStyle={styles.page}>
        {detail.state === 'loading' ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <View style={styles.titleBlock}>
            <Text variant="heading">
              {detail.state === 'missing' ? 'Hike not found' : "Couldn't open this hike"}
            </Text>
            <Text color="muted">
              {detail.state === 'missing'
                ? "It's no longer on this phone."
                : 'Go back and try again.'}
            </Text>
          </View>
        )}
      </Screen>
    );
  }

  const { hike, path, shared } = detail;

  return (
    // The header (with the back button) already sits under the status bar,
    // so no top edge; the tab bar pads the bottom.
    <Screen edges={[]} contentStyle={styles.page}>
      <View style={styles.titleBlock}>
        <Text variant="title" style={styles.title}>
          {hikeTitle(hike)}
        </Text>
        <Text variant="small" color="muted2">
          {formatHikeDate(hike.startedAt)}
        </Text>
      </View>

      {/* A still picture of the route: on a scrolling page, a drag should scroll. */}
      <LiveTrackMap path={path} live={false} style={styles.map} gestures={false} />

      {/* Whose numbers these are: the phone's estimate until the server's arrive. */}
      <Text variant="label" color="muted2" style={styles.note}>
        {statsNote(hike)}
      </Text>

      <HikeStatsGrid hike={hike} />
      <ElevationChart path={path} />
      {/* Its xp and what it unlocked, once the server has counted it. */}
      <HikeRewards hikeId={hike.id} uploaded={hike.syncStatus === 'synced'} />
      {/* As in the design: Share takes two thirds of the row, GPX the rest. */}
      <View style={styles.actions}>
        <ShareButton
          shared={shared}
          style={styles.share}
          onPress={() =>
            shared
              ? router.navigate('/feed')
              : router.push({
                  pathname: '/new-post/[hikeId]',
                  params: { hikeId: hike.id },
                })
          }
        />
        <ExportGpxButton hike={hike} style={styles.gpx} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 18,
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
  },
  map: {
    flex: 0,
    height: 210,
  },
  note: {
    paddingHorizontal: 8, // the design indents it a little from the stat boxes
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  share: {
    flex: 2,
  },
  gpx: {
    flex: 1,
  },
});
