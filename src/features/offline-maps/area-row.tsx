import { Pressable, StyleSheet, View } from 'react-native';

import { CheckCircle, DownloadSimple, MapTrifold } from '@/components/ui/icons';
import { Stripes } from '@/components/ui/stripes';
import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { areaMeta } from './offline-area';
import type { OfflineArea } from './offline-areas-store';

/**
 * One downloaded region, as in the design: a striped map tile, the name,
 * "18 MB · updated Oct 30", and on the right a check once it's ready, or a
 * small button (Resume, Update). A bar shows a download in progress.
 * Tapping the row offers to delete it.
 */
export function AreaRow({
  area,
  outdated,
  online,
  onPress,
  onResume,
  onUpdate,
}: {
  area: OfflineArea;
  /** The map data moved on since it was downloaded (see isOutOfDate). */
  outdated: boolean;
  online: boolean;
  onPress: () => void;
  onResume: () => void;
  onUpdate: () => void;
}) {
  const colors = useColors();
  const paused = !area.complete && !area.downloading;
  const meta = outdated && area.complete ? 'Map updated · update before your hike' : areaMeta(area);
  const action = paused ? 'Resume' : outdated && area.complete ? 'Update' : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${area.name}, ${meta}`}
      accessibilityHint="Opens options for this region"
      style={({ pressed }) => [
        styles.card,
        { borderColor: colors.line },
        pressed && { backgroundColor: colors.hover },
      ]}>
      <View style={styles.top}>
        <View style={styles.tile}>
          <Stripes id={`area-${area.id}`} size={12} />
          <MapTrifold size={20} color={colors.accentHi} />
        </View>
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={2}>
            {area.name}
          </Text>
          <Text variant="label" color={outdated && area.complete ? 'accentHi' : 'muted2'}>
            {meta}
          </Text>
        </View>
        {action ? (
          <Pressable
            onPress={action === 'Resume' ? onResume : onUpdate}
            disabled={!online}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.pill,
              { borderColor: online ? colors.accent : colors.line },
              pressed && { backgroundColor: colors.tint },
            ]}>
            <DownloadSimple size={14} color={online ? colors.accentText : colors.muted3} />
            <Text style={[styles.pillText, { color: online ? colors.accentText : colors.muted3 }]}>
              {online ? action : 'Needs signal'}
            </Text>
          </Pressable>
        ) : area.complete ? (
          <CheckCircle size={20} color={colors.accentHi} />
        ) : null}
      </View>
      {area.downloading ? (
        <View style={[styles.track, { backgroundColor: colors.line }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(100, area.percent)}%`, backgroundColor: colors.accent },
            ]}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: fonts.sans[500],
    fontSize: 15,
    lineHeight: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
