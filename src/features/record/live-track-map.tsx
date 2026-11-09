import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapView,
  type TrackUserLocation,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FOLLOW_ZOOM, MAP_STYLE_URL } from '@/config/map';
import type { PathPoint } from '@/db/track-points';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { boundsOf, toLineString } from './track-shape';

/** Space around the track when the whole hike is shown. */
const FIT_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

/**
 * The hike's track drawn on a map.
 *
 * - `live`: the map follows the hiker's blue dot. Dragging the map stops
 *   following; a Recenter button brings it back.
 * - not live (finished): the map frames the whole track.
 */
export function LiveTrackMap({ path, live }: { path: readonly PathPoint[]; live: boolean }) {
  const colors = useColors();
  const [following, setFollowing] = useState(true);

  const line = useMemo(() => toLineString(path), [path]);
  const bounds = useMemo(() => (live ? null : boundsOf(path)), [live, path]);
  const tracking: TrackUserLocation | undefined = live && following ? 'default' : undefined;

  return (
    <View style={[styles.frame, { borderColor: colors.line2 }]}>
      <MapView style={styles.map} mapStyle={MAP_STYLE_URL} compass={false}>
        <Camera
          initialViewState={{ zoom: FOLLOW_ZOOM }}
          trackUserLocation={tracking}
          // Fires with null when the user drags the map away from their dot.
          onTrackUserLocationChange={(e) => setFollowing(e.nativeEvent.trackUserLocation != null)}
          {...(bounds ? { bounds, padding: FIT_PADDING, duration: 0 } : {})}
        />
        {live && <UserLocation />}
        {path.length >= 2 && (
          <GeoJSONSource id="hike-track" data={line}>
            <Layer
              id="hike-track-line"
              type="line"
              style={{
                lineColor: colors.accent,
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </GeoJSONSource>
        )}
      </MapView>
      {live && !following && (
        <View style={styles.recenter}>
          <Button label="Recenter" variant="secondary" onPress={() => setFollowing(true)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    minHeight: 180,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  recenter: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
});
