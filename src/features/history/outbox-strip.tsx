import { StyleSheet, View } from 'react-native';

import { ArrowsClockwise, CloudSlash, Tray } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { useColors } from '@/theme/use-colors';

import { describeOutbox, type OutboxView } from './hike-summary';

const ICONS: Record<OutboxView['icon'], typeof Tray> = {
  offline: CloudSlash,
  syncing: ArrowsClockwise,
  queued: Tray,
};

/**
 * The thin strip above the history while hikes wait to upload: offline,
 * syncing now, or queued. Hidden once nothing waits. Hikes the server turned
 * down aren't counted here; their own rows say so, with a Retry button.
 */
export function OutboxStrip() {
  const colors = useColors();
  const waiting = useSyncStatusStore((s) => s.waiting);
  const syncing = useSyncStatusStore((s) => s.syncing);
  const online = useSyncStatusStore((s) => s.online);
  const view = describeOutbox({ waiting, syncing, online });
  if (!view) return null;
  const Icon = ICONS[view.icon];

  return (
    <View
      style={[styles.strip, { backgroundColor: colors.tint }]}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite">
      <Icon size={18} color={colors.accentText} />
      <Text variant="small" color="accentText" style={styles.label}>
        {view.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  label: {
    flexShrink: 1,
  },
});
