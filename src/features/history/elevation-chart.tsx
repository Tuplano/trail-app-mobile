import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { PathPoint } from '@/db/track-points';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { elevationProfile } from './elevation-profile';
import { formatCount } from './hike-summary';

/**
 * The hike's height along the way as bars, with its lowest and highest
 * point. Draws nothing when the GPS gave no heights.
 */
export function ElevationChart({ path }: { path: readonly PathPoint[] }) {
  const colors = useColors();
  const profile = useMemo(() => elevationProfile(path), [path]);
  if (!profile) return null;

  const range = `${formatCount(profile.minM)}–${formatCount(profile.maxM)} m`;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="small" style={styles.title}>
          Elevation
        </Text>
        <Text variant="small" color="muted2">
          {range}
        </Text>
      </View>
      <View
        style={styles.chart}
        accessible
        accessibilityLabel={`Elevation chart, from ${range.replace('–', ' to ')}`}>
        {profile.bars.map((height, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: `${height * 100}%`,
                // The design's fade from accent at the top to tint at the bottom.
                experimental_backgroundImage: `linear-gradient(${colors.accent}, ${colors.tint})`,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.sans[500],
  },
  chart: {
    height: 84,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});
