import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  formatClockTime,
  formatHikeDate,
  hikeDurationS,
  hikeTitle,
} from '@/features/history/hike-summary';
import { UploadBadge } from '@/features/history/upload-badge';
import { useHikeDetail } from '@/features/history/use-hikes';
import { LiveStats } from '@/features/record/live-stats';
import { LiveTrackMap } from '@/features/record/live-track-map';
import { useColors } from '@/theme/use-colors';

/** One finished hike: its route on the map and its stats, read from the phone. */
export default function HikeDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useHikeDetail(id);

  if (detail.state !== 'ready') {
    return (
      <Screen edges={[]} contentStyle={styles.page} scroll={false}>
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

  const { hike, path } = detail;

  return (
    // The header (with the back button) already sits under the status bar, so
    // no top edge. No scrolling: the map fills the free space, like on Record.
    <Screen edges={[]} contentStyle={styles.page} scroll={false}>
      <View style={styles.titleBlock}>
        <Text variant="title">{hikeTitle(hike)}</Text>
        <Text color="muted">
          {formatHikeDate(hike.startedAt)} · {formatClockTime(hike.startedAt)}
        </Text>
        <UploadBadge status={hike.syncStatus} />
      </View>

      <LiveTrackMap path={path} live={false} />
      <LiveStats
        stats={{
          pointCount: path.length,
          distanceM: hike.distanceM,
          elevationGainM: hike.elevationGainM,
          movingTimeS: hike.movingTimeS,
        }}
        elapsedS={hikeDurationS(hike)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  titleBlock: {
    gap: 6,
  },
});
