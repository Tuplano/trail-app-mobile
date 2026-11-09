import type { LngLat, LngLatBounds } from '@maplibre/maplibre-react-native';

import type { PathPoint } from '@/db/track-points';

type Point = Pick<PathPoint, 'lat' | 'lng'>;

/** Map coordinates are [longitude, latitude], the reverse of how we store them. */
export function toLngLat(point: Point): LngLat {
  return [point.lng, point.lat];
}

/** The hike's path as a GeoJSON line for the map to draw. */
export function toLineString(path: readonly Point[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: path.map(toLngLat) },
  };
}

/** The box around the whole path ([west, south, east, north]), or null if empty. */
export function boundsOf(path: readonly Point[]): LngLatBounds | null {
  if (path.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const { lat, lng } of path) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}
