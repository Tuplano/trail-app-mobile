import { Camera, Map as MapView, type MapRef, UserLocation } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DownloadSimple } from '@/components/ui/icons';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { MAP_STYLE_URLS } from '@/config/map';
import {
  type Bounds,
  checkArea,
  dataNote,
  downloadBlocker,
  formatSize,
} from '@/features/offline-maps/offline-area';
import { useOfflineAreasStore } from '@/features/offline-maps/offline-areas-store';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/** Where the map opens when the phone's position isn't known: Metro Manila. */
const FALLBACK_CENTER: [number, number] = [121.0, 14.6];
/** About 40 km across: a mountain and its trailheads. */
const START_ZOOM = 10;

/**
 * Choose a region to download: everything on the map is saved. Pan and zoom
 * to the mountain, name it, check the size, download. Not in the design (it
 * shows only the list); laid out like the Record map with a panel below.
 */
export default function NewOfflineMapScreen() {
  const colors = useColors();
  const mapRef = useRef<MapRef>(null);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [name, setName] = useState('');
  const [starting, setStarting] = useState(false);
  const online = useSyncStatusStore((s) => s.online);
  const unmetered = useSyncStatusStore((s) => s.unmetered);
  const usedBytes = useOfflineAreasStore((s) =>
    s.areas.reduce((sum, area) => sum + area.sizeBytes, 0),
  );

  // Open on the hiker's last known position, without waiting for a fresh fix.
  useEffect(() => {
    let cancelled = false;
    Location.getLastKnownPositionAsync()
      .then((position) => position && [position.coords.longitude, position.coords.latitude])
      .catch(() => null)
      .then((found) => {
        if (!cancelled) setCenter((found as [number, number] | null) ?? FALLBACK_CENTER);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const check = bounds ? checkArea(bounds) : null;
  const blocker = check ? downloadBlocker({ name, check, online, usedBytes }) : null;
  const note = check && !blocker ? dataNote(unmetered, check.estimatedBytes) : null;

  const download = () => {
    if (!bounds || blocker) return;
    setStarting(true);
    useOfflineAreasStore
      .getState()
      .download(name, bounds)
      .then(() => router.back())
      .catch((e: unknown) => {
        console.warn('Could not start the download', e);
        useOfflineAreasStore.setState({ error: 'The download could not start. Please try again.' });
        router.back();
      });
  };

  return (
    <Screen edges={['bottom']} scroll={false} contentStyle={styles.page}>
      <View style={[styles.mapFrame, { borderColor: colors.line2 }]}>
        {center ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            mapStyle={MAP_STYLE_URLS.dark}
            compass={false}
            touchRotate={false}
            touchPitch={false}
            onDidFinishLoadingMap={() => {
              mapRef.current
                ?.getBounds()
                .then(setBounds)
                .catch(() => {});
            }}
            onRegionDidChange={(e) => setBounds(e.nativeEvent.bounds)}>
            <Camera initialViewState={{ center, zoom: START_ZOOM }} />
            <UserLocation />
          </MapView>
        ) : null}
        <View style={[styles.hint, { backgroundColor: colors.glass, borderColor: colors.line }]}>
          <Text variant="label" color="text2">
            Everything on the map is saved
          </Text>
        </View>
      </View>

      <View style={styles.panel}>
        <TextField
          label="Region name"
          placeholder="e.g. Mt. Pulag"
          value={name}
          onChangeText={setName}
          returnKeyType="done"
          maxLength={60}
        />
        <Text variant="small" color={check?.tooBig ? 'err' : 'muted'}>
          {check
            ? (blocker ?? `About ${formatSize(check.estimatedBytes)}`)
            : 'Move the map to the area of your hike.'}
        </Text>
        {note ? (
          <Text variant="label" color="muted2">
            {note}
          </Text>
        ) : null}
        <Button
          label="Download"
          icon={<DownloadSimple size={18} color={colors.accentText} />}
          onPress={download}
          loading={starting}
          disabled={!check || blocker !== null}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 14,
  },
  mapFrame: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  hint: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  panel: {
    gap: 10,
  },
});
