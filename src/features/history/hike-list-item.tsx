import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ArrowClockwise,
  ArrowsClockwise,
  CheckCircle,
  Clock,
  type IconProps,
  Path,
  Timer,
  TrendUp,
  Warning,
} from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import type { HistoryHike } from '@/db/hikes';
import { formatKm } from '@/features/record/format';
import { retryHikeUpload } from '@/sync/sync';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { type ColorName, fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import {
  describeHikeSync,
  formatCount,
  formatHikeDate,
  formatHikeDuration,
  hikeTitle,
  type SyncChip,
} from './hike-summary';

type Icon = React.ComponentType<IconProps>;

/** The design's upload chips: label, icon, text color and background. */
const CHIPS: Record<SyncChip, { label: string; Icon: Icon; color: ColorName; bg: ColorName | null }> =
  {
    pending: { label: 'Pending', Icon: Clock, color: 'text2', bg: 'line2' },
    uploading: { label: 'Uploading', Icon: ArrowsClockwise, color: 'accentText', bg: 'tint' },
    synced: { label: 'Synced', Icon: CheckCircle, color: 'accentHi', bg: null },
    failed: { label: 'Failed', Icon: Warning, color: 'err', bg: 'errBg' },
  };

/**
 * One hike in the history: name and start time, an upload chip, distance,
 * moving time and climb, and a note on the upload (with Retry if the server
 * turned it down). Tapping opens the hike.
 */
export function HikeListItem({ hike }: { hike: HistoryHike }) {
  const colors = useColors();
  const online = useSyncStatusStore((s) => s.online);
  // Only this hike's upload, so the other rows don't re-render on every chunk.
  const progress = useSyncStatusStore((s) =>
    s.uploadProgress?.hikeId === hike.id ? s.uploadProgress : null,
  );
  const [retrying, setRetrying] = useState(false);
  const sync = describeHikeSync(hike, online, progress);
  const chip = CHIPS[sync.chip];

  const title = hikeTitle(hike);
  const date = formatHikeDate(hike.startedAt);
  const km = formatKm(hike.distanceM);
  const time = formatHikeDuration(hike.movingTimeS);
  const gain = formatCount(hike.elevationGainM);

  const retry = () => {
    setRetrying(true);
    retryHikeUpload(hike.id)
      .catch((error: unknown) => console.warn('Could not retry the upload', error))
      .finally(() => setRetrying(false));
  };

  return (
    // A plain Pressable with router.push, not <Link asChild>: Link's wrapper
    // drops a style given as a function, so the pressed look would be lost.
    <Pressable
      onPress={() => router.push({ pathname: '/hikes/[id]', params: { id: hike.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${date}. ${km} kilometers, ${time} moving, ${gain} meters up. ${chip.label}.`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.hover : colors.surface, borderColor: colors.line2 },
      ]}>
      <View style={styles.top}>
        <View style={styles.heading}>
          <Text variant="subheading" style={styles.title}>
            {title}
          </Text>
          <Text variant="label" color="muted2">
            {date}
          </Text>
        </View>
        <View style={[styles.chip, { backgroundColor: chip.bg ? colors[chip.bg] : 'transparent' }]}>
          <chip.Icon size={13} color={colors[chip.color]} />
          <Text variant="label" color={chip.color} style={styles.medium}>
            {chip.label}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat Icon={Path} value={`${km} km`} />
        <Stat Icon={Timer} value={time} />
        <Stat Icon={TrendUp} value={`${gain} m`} />
      </View>

      <View style={styles.bottom}>
        <Text variant="label" color={sync.problem ? 'err' : 'muted2'} style={styles.note}>
          {sync.note}
        </Text>
        {sync.canRetry && (
          <Pressable
            onPress={retry}
            disabled={retrying}
            accessibilityRole="button"
            accessibilityLabel={`Retry uploading ${title}`}
            accessibilityState={{ busy: retrying }}
            style={({ pressed }) => [
              styles.retry,
              { borderColor: colors.accent, backgroundColor: pressed ? colors.tint : 'transparent' },
              retrying && styles.busy,
            ]}>
            <ArrowClockwise size={13} color={colors.accentText} />
            <Text variant="label" color="accentText">
              Retry
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function Stat({ Icon, value }: { Icon: Icon; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.stat}>
      <Icon size={15} color={colors.accentHi} />
      <Text variant="small" color="text2" style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  heading: {
    flexShrink: 1,
    gap: 3,
  },
  title: {
    lineHeight: 21, // the design's 1.3 line height, tighter than the 22 of `subheading`
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
  },
  medium: {
    fontFamily: fonts.sans[500],
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  note: {
    flexShrink: 1,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
  },
  busy: {
    opacity: 0.6,
  },
});
