import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { HikeStats } from '@/tracking/hike-stats';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { formatDuration, formatKm, formatMeters, formatPace } from './format';

/**
 * The four numbers hikers check on the trail. Elapsed time ticks every second;
 * the rest update with each saved GPS point.
 */
export function LiveStats({ stats, elapsedS }: { stats: HikeStats; elapsedS: number }) {
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <Stat label="Time" value={formatDuration(elapsedS)} />
        <Stat label="Distance" value={formatKm(stats.distanceM)} unit="km" />
      </View>
      <View style={styles.row}>
        <Stat label="Elevation gain" value={formatMeters(stats.elevationGainM)} unit="m" />
        <Stat label="Pace" value={formatPace(stats.movingTimeS, stats.distanceM)} unit="/km" />
      </View>
    </View>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const colors = useColors();
  return (
    <View
      style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.line2 }]}
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}>
      <Text variant="label" color="muted">
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text variant="title" style={styles.value}>
          {value}
        </Text>
        {unit && (
          <Text variant="small" color="muted">
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flex: 1,
    gap: 6,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    // Digits keep the same width, so a ticking clock doesn't jiggle.
    fontVariant: ['tabular-nums'],
  },
});
