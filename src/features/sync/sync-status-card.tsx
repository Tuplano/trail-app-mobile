import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { retryUploads } from '@/sync/sync';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { type ColorName, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { describeSyncStatus, type SyncStatusView } from './sync-status';

const DOT_COLOR: Record<SyncStatusView['tone'], ColorName> = {
  done: 'muted3',
  waiting: 'accent',
  problem: 'err',
};

/**
 * Shows whether finished hikes have reached the server: all uploaded, how
 * many are waiting (and why), or which ones failed, with a Retry button.
 */
export function SyncStatusCard() {
  const colors = useColors();
  const snapshot = useSyncStatusStore();
  const view = describeSyncStatus(snapshot);
  const [retrying, setRetrying] = useState(false);

  const retry = () => {
    setRetrying(true);
    retryUploads()
      .catch((error: unknown) => console.warn('Could not retry uploads', error))
      .finally(() => setRetrying(false));
  };

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}
      accessibilityRole="summary"
      accessibilityLabel={[view.title, view.detail].filter(Boolean).join('. ')}>
      <View style={styles.titleRow}>
        {view.busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <View style={[styles.dot, { backgroundColor: colors[DOT_COLOR[view.tone]] }]} />
        )}
        <Text variant="subheading" style={styles.title}>
          {view.title}
        </Text>
      </View>
      {view.detail && (
        <Text variant="small" color="muted">
          {view.detail}
        </Text>
      )}
      {view.canRetry && (
        <Button label="Retry now" variant="secondary" onPress={retry} loading={retrying} />
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    flexShrink: 1,
  },
});
