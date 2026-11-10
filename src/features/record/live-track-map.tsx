import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapView,
  type TrackUserLocation,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, useColorScheme, View, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui/button';
import { FOLLOW_ZOOM, MAP_STYLE_URLS } from '@/config/map';
import type { PathPoint } from '@/db/track-points';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { atLeastSpan, boundsOf, toLineString, toPointFeature } from './track-shape';

/** Space around the track when the whole hike is shown. */
const FIT_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

/**
 * The hike's track drawn on a map.
 *
 * - `live`: the map follows the hiker's blue dot. Dragging the map stops
 *   following; a Recenter button brings it back.
 * - not live (finished): the map frames the whole track.
 *
 * `style` overrides the frame's size (it fills the free space by default).
 * `gestures={false}` makes it a still picture, e.g. inside a scrolling page,
 * where dragging should scroll the page rather than move the map.
 * `bottomInset` lifts the logo, attribution and Recenter button, e.g. above
 * a panel that overlaps the map's lower edge.
 */
export function LiveTrackMap({
  path,
  live,
  style,
  gestures = true,
  bottomInset = 0,
}: {
  path: readonly PathPoint[];
  live: boolean;
  style?: ViewStyle;
  gestures?: boolean;
  bottomInset?: number;
}) {
  const colors = useColors();
  // Same rule as useColors(): dark unless the theme is light.
  const mapStyle = MAP_STYLE_URLS[useColorScheme() === 'light' ? 'light' : 'dark'];
  const [following, setFollowing] = useState(true);

  const line = useMemo(() => toLineString(path), [path]);
  const start = useMemo(() => (path.length > 0 ? toPointFeature(path[0]) : null), [path]);
  const end = useMemo(() => (path.length > 1 ? toPointFeature(path[path.length - 1]) : null), [path]);
  const bounds = useMemo(() => {
    const box = live ? null : boundsOf(path);
    return box ? atLeastSpan(box) : null;
  }, [live, path]);
  const tracking: TrackUserLocation | undefined = live && following ? 'default' : undefined;

  return (
    <View style={[styles.frame, { borderColor: colors.line2 }, style]}>
      <MapView
        style={styles.map}
        mapStyle={mapStyle}
        compass={false}
        logoPosition={{ bottom: 8 + bottomInset, left: 8 }}
        attributionPosition={{ bottom: 8 + bottomInset, right: 8 }}
        dragPan={gestures}
        touchZoom={gestures}
        doubleTapZoom={gestures}
        doubleTapHoldZoom={gestures}
        touchRotate={gestures}
        touchPitch={gestures}>
        <Camera
          initialViewState={{ zoom: FOLLOW_ZOOM }}
          trackUserLocation={tracking}
          // Fires with null when the user drags the map away from their dot.
          onTrackUserLocationChange={(e) => setFollowing(e.nativeEvent.trackUserLocation != null)}
          {...(bounds ? { bounds, padding: FIT_PADDING, duration: 0 } : {})}
        />
        {live && <UserLocation />}
        {/* Drawn as in the design: a soft wide band under a thin bright line. */}
        {path.length >= 2 && (
          <GeoJSONSource id="hike-track" data={line}>
            <Layer
              id="hike-track-casing"
              type="line"
              style={{
                lineColor: colors.accent,
                lineOpacity: 0.28,
                lineWidth: 10,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Layer
              id="hike-track-line"
              type="line"
              style={{
                lineColor: colors.accentHi,
                lineWidth: 3.5,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </GeoJSONSource>
        )}
        {/* Where the hike started: a hollow dot. */}
        {start && (
          <GeoJSONSource id="hike-start" data={start}>
            <Layer
              id="hike-start-dot"
              type="circle"
              style={{
                circleRadius: 5,
                circleColor: colors.bg,
                circleStrokeColor: colors.text,
                circleStrokeWidth: 2,
              }}
            />
          </GeoJSONSource>
        )}
        {/* Where it ended: a filled dot. While live, the blue location dot shows the end instead. */}
        {!live && end && (
          <GeoJSONSource id="hike-end" data={end}>
            <Layer
              id="hike-end-dot"
              type="circle"
              style={{
                circleRadius: 5,
                circleColor: colors.accentText,
                circleStrokeColor: colors.bg,
                circleStrokeWidth: 2,
              }}
            />
          </GeoJSONSource>
        )}
      </MapView>
      {live && !following && (
        <View style={[styles.recenter, { bottom: 12 + bottomInset }]}>
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
  },
});
