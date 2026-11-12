import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map as MapView,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { type ReactNode, type Ref, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { MapPin } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { MAP_STYLE_URLS } from '@/config/map';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { circlePolygon, type Zone, type ZoneDraft } from './privacy-zones';

/** ~3 km across a phone-wide map: a 1000 m zone still fits. */
export const ZONE_ZOOM = 14;
/** Height of the map; the search list is kept inside it. */
export const ZONE_MAP_HEIGHT = 250;
const PIN = 28;

/**
 * The design's zone map. Your other zones are drawn faintly; the zone being
 * edited is the bright circle around a pin fixed in the middle. Dragging the
 * map moves that zone: its center is always the middle of the map.
 */
export function ZoneMap({
  cameraRef,
  initialCenter,
  zones,
  draft,
  onCenterChange,
  overlay,
}: {
  cameraRef: Ref<CameraRef>;
  /** [longitude, latitude] */
  initialCenter: [number, number];
  zones: readonly Zone[];
  draft: ZoneDraft | null;
  onCenterChange: (center: { lat: number; lng: number }, byUser: boolean) => void;
  /** Floats over the top of the map, e.g. the place search. */
  overlay?: ReactNode;
}) {
  const colors = useColors();
  const mapStyle = MAP_STYLE_URLS[useColorScheme() === 'light' ? 'light' : 'dark'];
  // Only the first value counts: later moves go through cameraRef.
  const [startCenter] = useState(initialCenter);

  const others = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: zones
        .filter((zone) => zone.id !== draft?.id)
        .map((zone) => circlePolygon(zone, zone.radiusM)),
    }),
    [zones, draft?.id],
  );
  const editing = useMemo(
    () => (draft ? circlePolygon(draft, draft.radiusM) : null),
    [draft],
  );

  return (
    <View style={[styles.frame, { borderColor: colors.line }]}>
      <MapView
        style={styles.map}
        mapStyle={mapStyle}
        compass={false}
        touchRotate={false}
        touchPitch={false}
        attributionPosition={{ bottom: 8, right: 8 }}
        // The search box takes the top, so the logo sits by the attribution.
        logoPosition={{ bottom: 8, right: 36 }}
        onRegionIsChanging={(e) => {
          const [lng, lat] = e.nativeEvent.center;
          onCenterChange({ lat, lng }, e.nativeEvent.userInteraction);
        }}
        onRegionDidChange={(e) => {
          const [lng, lat] = e.nativeEvent.center;
          onCenterChange({ lat, lng }, e.nativeEvent.userInteraction);
        }}>
        <Camera ref={cameraRef} initialViewState={{ center: startCenter, zoom: ZONE_ZOOM }} />
        <UserLocation />
        <GeoJSONSource id="zones-other" data={others}>
          <Layer
            id="zones-other-fill"
            type="fill"
            style={{ fillColor: colors.accent, fillOpacity: 0.12 }}
          />
          <Layer
            id="zones-other-line"
            type="line"
            style={{ lineColor: colors.accentDim, lineWidth: 1 }}
          />
        </GeoJSONSource>
        {editing && (
          // The design's glow fill with a thin accent ring.
          <GeoJSONSource id="zone-editing" data={editing}>
            <Layer
              id="zone-editing-fill"
              type="fill"
              style={{ fillColor: colors.accent, fillOpacity: 0.28 }}
            />
            <Layer
              id="zone-editing-line"
              type="line"
              style={{ lineColor: colors.accent, lineWidth: 1.5 }}
            />
          </GeoJSONSource>
        )}
      </MapView>

      {draft && (
        // The pin's tip sits on the map's center, as in the design.
        <View pointerEvents="none" style={styles.pin}>
          <MapPin size={PIN} weight="fill" color={colors.accentText} />
        </View>
      )}
      <View pointerEvents="none" style={styles.hint}>
        <Text variant="mono" color="faint">
          {draft ? 'DRAG TO PLACE ZONE' : 'ADD A ZONE TO PLACE IT'}
        </Text>
      </View>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: ZONE_MAP_HEIGHT,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  pin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -PIN / 2,
    marginTop: -PIN + 2,
  },
  hint: {
    position: 'absolute',
    bottom: 10,
    left: 12,
  },
});
