import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { DownloadSimple } from '@/components/ui/icons';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { AreaRow } from '@/features/offline-maps/area-row';
import { formatSize, isOutOfDate, storageUse } from '@/features/offline-maps/offline-area';
import {
  type OfflineArea,
  useOfflineAreasStore,
} from '@/features/offline-maps/offline-areas-store';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * The design's Offline maps screen: how much room the saved regions take,
 * each region with its size and date, and a way to download another. The
 * Record map uses them by itself when there's no signal.
 */
export default function OfflineMapsScreen() {
  const colors = useColors();
  const { areas, loaded, error, currentVersion } = useOfflineAreasStore();
  const online = useSyncStatusStore((s) => s.online) !== false;
  const used = areas.reduce((sum, area) => sum + area.sizeBytes, 0);
  const storage = storageUse(used);

  useFocusEffect(
    useCallback(() => {
      useOfflineAreasStore
        .getState()
        .load()
        .catch((e: unknown) => console.warn('Could not read offline maps', e));
    }, []),
  );

  const run = (action: () => Promise<void>) => () => {
    action().catch((e: unknown) => {
      console.warn('Offline map action failed', e);
      useOfflineAreasStore.setState({ error: 'Something went wrong. Please try again.' });
    });
  };

  const confirmDelete = (area: OfflineArea) => {
    Alert.alert(
      area.name,
      `Delete this region from your phone? It frees ${formatSize(area.sizeBytes)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: run(() => useOfflineAreasStore.getState().remove(area.id)),
        },
      ],
    );
  };

  return (
    // The header (with the back button) sits under the status bar already.
    <Screen edges={[]} contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text variant="title">Offline maps</Text>
        <Text variant="small" color="muted2">
          Download regions before you lose signal. Recording works without them.
        </Text>
      </View>

      <View
        style={[styles.storage, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
        <View style={styles.storageTop}>
          <Text variant="small">Storage</Text>
          <Text variant="small" color="muted">
            {storage.label}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.line }]}>
          <View
            style={[
              styles.fill,
              { width: `${storage.fraction * 100}%`, backgroundColor: colors.accent },
            ]}
          />
        </View>
      </View>

      <FormError message={error} />

      {areas.map((area) => (
        <AreaRow
          key={area.id}
          area={area}
          outdated={isOutOfDate(area.version, currentVersion)}
          online={online}
          onPress={() => confirmDelete(area)}
          onResume={run(() => useOfflineAreasStore.getState().resume(area.id))}
          onUpdate={run(() => useOfflineAreasStore.getState().update(area.id))}
        />
      ))}
      {loaded && areas.length === 0 ? (
        <Text variant="small" color="muted2" style={styles.empty}>
          No regions yet. Download the area of your next hike while you have signal.
        </Text>
      ) : null}

      <Button
        label={online ? 'Download a new region' : 'Needs signal'}
        icon={<DownloadSimple size={18} color={colors.accentText} />}
        disabled={!online}
        onPress={() => router.push('/offline-map-new')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 18,
  },
  heading: {
    gap: 6,
  },
  storage: {
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  storageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  empty: {
    paddingHorizontal: 4,
  },
});
