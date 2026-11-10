import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { Hike } from '@/db/hikes';
import { formatDuration, formatKm, formatMeters } from '@/features/record/format';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { formatHikeDate, hikeDurationS, hikeTitle } from './hike-summary';
import { UploadBadge } from './upload-badge';

/**
 * One hike in the history: name, date, the three numbers hikers compare,
 * and an upload badge until the hike is on the server. Tapping opens it.
 */
export function HikeListItem({ hike }: { hike: Hike }) {
  const colors = useColors();
  const title = hikeTitle(hike);
  const date = formatHikeDate(hike.startedAt);
  const km = formatKm(hike.distanceM);
  const duration = formatDuration(hikeDurationS(hike));
  const gain = formatMeters(hike.elevationGainM);

  return (
    // A plain Pressable with router.push, not <Link asChild>: Link's wrapper
    // drops a style given as a function, so the pressed look would be lost.
    <Pressable
      onPress={() => router.push({ pathname: '/hikes/[id]', params: { id: hike.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${date}. ${km} kilometers in ${duration}, ${gain} meters climbed.`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.hover : colors.surface,
          borderColor: colors.line2,
        },
      ]}>
      <View style={styles.header}>
        <Text variant="subheading" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="small" color="muted">
          {date}
        </Text>
      </View>
      <View style={styles.stats}>
        <Stat value={km} unit="km" />
        <Stat value={duration} />
        <Stat value={gain} unit="m up" />
      </View>
      {/* Uploaded is the normal end state, so only the exceptions get a badge. */}
      {hike.syncStatus !== 'synced' && <UploadBadge status={hike.syncStatus} />}
    </Pressable>
  );
}

function Stat({ value, unit }: { value: string; unit?: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="bodyStrong" style={styles.value}>
        {value}
      </Text>
      {unit && (
        <Text variant="small" color="muted">
          {unit}
        </Text>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flexShrink: 1,
  },
  stats: {
    flexDirection: 'row',
    gap: 20,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
});
