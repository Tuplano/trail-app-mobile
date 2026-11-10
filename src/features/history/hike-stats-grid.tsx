import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { Hike } from '@/db/hikes';
import { formatKm, formatPace } from '@/features/record/format';
import { useColors } from '@/theme/use-colors';

import { formatCount, formatHikeDuration } from './hike-summary';

type Stats = Pick<Hike, 'distanceM' | 'movingTimeS' | 'elevationGainM'>;

/** A finished hike's four numbers, two by two, as on the design's hike screen. */
export function HikeStatsGrid({ hike }: { hike: Stats }) {
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <Stat label="DISTANCE" value={`${formatKm(hike.distanceM)} km`} />
        <Stat label="MOVING TIME" value={formatHikeDuration(hike.movingTimeS)} />
      </View>
      <View style={styles.row}>
        <Stat label="ELEVATION GAIN" value={`${formatCount(hike.elevationGainM)} m`} />
        <Stat label="AVG PACE" value={`${formatPace(hike.movingTimeS, hike.distanceM)} /km`} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View
      style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.line2 }]}
      accessible
      accessibilityLabel={`${label.toLowerCase()}: ${value}`}>
      <Text variant="label" color="muted2" style={styles.label}>
        {label}
      </Text>
      <Text variant="heading" style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    gap: 4,
    padding: 14,
    borderRadius: 12, // the design's stat boxes have slightly tighter corners than cards (14)
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.66,
  },
  value: {
    fontSize: 22,
    lineHeight: 27,
    fontVariant: ['tabular-nums'],
  },
});
