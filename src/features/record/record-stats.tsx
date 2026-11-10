import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { HikeStats } from '@/tracking/hike-stats';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { formatKm, formatMeters, formatPace } from './format';

/** Distance, climb and pace, as the design lists them while recording. */
function recordStats(stats: HikeStats) {
  return [
    { key: 'DISTANCE', value: formatKm(stats.distanceM), unit: 'km' },
    { key: 'CLIMB', value: formatMeters(stats.elevationGainM), unit: 'm' },
    { key: 'PACE', value: formatPace(stats.movingTimeS, stats.distanceM), unit: '/km' },
  ];
}

/** Map view: the three numbers side by side under the clock. */
export function RecordStatsRow({ stats }: { stats: HikeStats }) {
  return (
    <View style={styles.row}>
      {recordStats(stats).map((s) => (
        <View
          key={s.key}
          style={styles.cell}
          accessible
          accessibilityLabel={`${s.key.toLowerCase()}: ${s.value} ${s.unit}`}>
          <Text style={styles.rowValue}>{s.value}</Text>
          <Text variant="label" color="muted2" style={styles.caps}>
            {s.key} · {s.unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Stats view: one big number per line, with a rule between them. */
export function RecordStatsList({ stats }: { stats: HikeStats }) {
  const colors = useColors();
  return (
    <View>
      {recordStats(stats).map((s) => (
        <View
          key={s.key}
          style={[styles.line, { borderTopColor: colors.line2 }]}
          accessible
          accessibilityLabel={`${s.key.toLowerCase()}: ${s.value} ${s.unit}`}>
          <Text variant="label" color="muted2" style={styles.caps}>
            {s.key}
          </Text>
          <View style={styles.valueWithUnit}>
            <Text style={styles.bigValue}>{s.value}</Text>
            <Text variant="small" color="muted">
              {s.unit}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  cell: {
    flex: 1,
    gap: 4,
  },
  rowValue: {
    fontFamily: fonts.sans[500],
    fontSize: 22,
    lineHeight: 27,
    fontVariant: ['tabular-nums'],
  },
  caps: {
    fontSize: 11,
    letterSpacing: 0.66,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  valueWithUnit: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  bigValue: {
    fontFamily: fonts.sans[500],
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.1,
    fontVariant: ['tabular-nums'],
  },
});
