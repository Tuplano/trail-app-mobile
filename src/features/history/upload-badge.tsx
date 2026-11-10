import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { SyncStatus } from '@/db/hikes';
import type { ColorName } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { describeUpload, type UploadBadge as Badge } from './hike-summary';

/** Same dot colors as the sync status card on Home. */
const DOT_COLOR: Record<Badge['tone'], ColorName> = {
  done: 'muted3',
  waiting: 'accent',
  problem: 'err',
};

/** A dot and a word or two saying whether this hike has reached the server. */
export function UploadBadge({ status }: { status: SyncStatus }) {
  const colors = useColors();
  const { label, tone } = describeUpload(status);

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: colors[DOT_COLOR[tone]] }]} />
      <Text variant="label" color={tone === 'problem' ? 'err' : 'muted'}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
