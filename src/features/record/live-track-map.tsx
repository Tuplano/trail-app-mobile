import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  type LngLat,
  Map as MapView,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useColorScheme, View, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui/button';
import { FALLBACK_CENTER, FOLLOW_ZOOM, MAP_STYLE_URLS } from '@/config/map';
import type { PathPoint } from '@/db/track-points';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { type CameraMove, cameraMove } from './follow-camera';
import { atLeastSpan, boundsOf, toLineString, toLngLat, toPointFeature } from './track-shape';

/** Space around the track when the whole hike is shown. */
const FIT_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

/** How zoomed out the map opens before it knows where the hiker is. */
const UNKNOWN_ZOOM = 10;

/**
 * The hike's track drawn on a map.
 *
 * - `live` (before Start and while recording): a "you are here" dot at
 *   `here`, and the map follows it. Dragging the map stops following; a
 *   Recenter button brings it back, at the following zoom.
 * - not live (finished): the map frames the whole track.
 *
 * `here` is where the phone is now (see useHere), or null while unknown.
 * `style` overrides the frame's size (it fills the free space by default).
 * `gestures={false}` makes it a still picture, e.g. inside a scrolling page,
 * where dragging should scroll the page rather than move the map.
 * `bottomInset` lifts the logo, attribution and Recenter button, e.g. above
 * a panel that overlaps the map's lower edge.
 */
export function LiveTrackMap({
  path,
  live,
  here = null,
  style,
  gestures = true,
  bottomInset = 0,
}: {
  path: readonly PathPoint[];
  live: boolean;
  here?: LngLat | null;
  style?: ViewStyle;
  gestures?: boolean;
  bottomInset?: number;
}) {
  const colors = useColors();
  // Same rule as useColors(): dark unless the theme is light.
  const mapStyle = MAP_STYLE_URLS[useColorScheme() === 'light' ? 'light' : 'dark'];
  const cameraRef = useRef<CameraRef>(null);
  const [following, setFollowing] = useState(true);
  // Camera moves made before the map has loaded are lost: it applies its
  // starting view once loaded, over them. So moves wait for this.
  const [mapLoaded, setMapLoaded] = useState(false);

  const line = useMemo(() => toLineString(path), [path]);
  const start = useMemo(() => (path.length > 0 ? toPointFeature(path[0]) : null), [path]);
  const end = useMemo(() => (path.length > 1 ? toPointFeature(path[path.length - 1]) : null), [path]);
  const bounds = useMemo(() => {
    const box = live ? null : boundsOf(path);
    return box ? atLeastSpan(box) : null;
  }, [live, path]);
  // While recording, the newest saved point stands in until the phone reports.
  const lastPoint = path.length > 0 ? path[path.length - 1] : null;
  const position: LngLat | null = live ? (here ?? (lastPoint ? toLngLat(lastPoint) : null)) : null;
  const [lng, lat] = position ?? [null, null];
  const dot = useMemo(
    () => (lng !== null && lat !== null ? toPointFeature({ lng, lat }) : null),
    [lng, lat],
  );
  // Whether the camera is already on the hiker: true from the start when the
  // map opens with their position known (see initialViewState below).
  const placed = useRef(position !== null);

  const move = (next: CameraMove) => {
    const camera = cameraRef.current;
    if (!camera || !mapLoaded || next.type === 'none') return;
    placed.current = true;
    if (next.type === 'jump') camera.jumpTo({ center: next.center, zoom: next.zoom });
    else if (next.type === 'ease') camera.easeTo({ center: next.center, duration: 500 });
    else camera.flyTo({ center: next.center, zoom: next.zoom, duration: 800 });
  };

  // Follow the hiker as their position changes.
  useEffect(() => {
    if (!live) return;
    move(cameraMove({ here: position, following, placed: placed.current }));
    // Only a new position should move the camera; `following` turning back
    // on is handled by Recenter itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, mapLoaded, lng, lat]);

  const recenter = () => {
    setFollowing(true);
    move(cameraMove({ here: position, following: true, placed: placed.current, recenter: true }));
  };

  // Opens on the hiker when already known, else zoomed out over a default
  // area until the first position arrives (then it jumps in).
  const initialViewState = position
    ? { center: position, zoom: FOLLOW_ZOOM }
    : { center: FALLBACK_CENTER, zoom: UNKNOWN_ZOOM };

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
        touchPitch={gestures}
        onDidFinishLoadingMap={() => setMapLoaded(true)}
        // Dragging or zooming the map stops following, until Recenter.
        onRegionWillChange={(e) => {
          if (live && e.nativeEvent.userInteraction) setFollowing(false);
        }}>
        <Camera
          ref={cameraRef}
          initialViewState={initialViewState}
          {...(bounds ? { bounds, padding: FIT_PADDING, duration: 0 } : {})}
        />
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
        {/* Where it ended: a filled dot. While live, the "you are here" dot shows the end instead. */}
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
        {/* Where the hiker is now: a soft halo under a bright dot, drawn on top. */}
        {dot && (
          <GeoJSONSource id="you-are-here" data={dot}>
            <Layer
              id="you-are-here-halo"
              type="circle"
              style={{ circleRadius: 14, circleColor: colors.accent, circleOpacity: 0.28 }}
            />
            <Layer
              id="you-are-here-dot"
              type="circle"
              style={{
                circleRadius: 6,
                circleColor: colors.accentHi,
                circleStrokeColor: colors.text,
                circleStrokeWidth: 2,
              }}
            />
          </GeoJSONSource>
        )}
      </MapView>
      {live && !following && position && (
        <View style={[styles.recenter, { bottom: 12 + bottomInset }]}>
          <Button label="Recenter" variant="secondary" onPress={recenter} />
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
