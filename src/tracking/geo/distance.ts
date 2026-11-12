// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

import type { LatLng } from './types';

/** Mean Earth radius in meters (IUGG). */
const EARTH_RADIUS_M = 6_371_008.8;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Great-circle distance between two points, in meters, on a round Earth.
 * Good for checks such as speed limits; route length uses pathDistance.
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2;

  // Math.min guards against floating-point error pushing h just above 1.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// The WGS84 ellipsoid (what GPS uses): equatorial radius and eccentricity squared.
const WGS84_A_M = 6_378_137;
const WGS84_E2 = 0.00669437999014;

/**
 * Distance between two nearby points on the WGS84 ellipsoid, in meters. The
 * Earth is slightly flattened, so near the equator a degree of latitude is
 * shorter than on a sphere: haversine measures north-south steps in the
 * Philippines up to ~0.5% too long. Uses the ellipsoid's radii of curvature
 * at the two points' mid-latitude, which is exact to well under a
 * centimeter for the meters-apart fixes of a recording.
 */
export function ellipsoidDistance(a: LatLng, b: LatLng): number {
  const lat = toRadians((a.lat + b.lat) / 2);
  const sin = Math.sin(lat);
  const w = Math.sqrt(1 - WGS84_E2 * sin * sin);
  const northRadius = (WGS84_A_M * (1 - WGS84_E2)) / w ** 3;
  const eastRadius = WGS84_A_M / w;
  const north = toRadians(b.lat - a.lat) * northRadius;
  const east = toRadians(b.lng - a.lng) * eastRadius * Math.cos(lat);
  return Math.hypot(north, east);
}

/** Total length of a route, in meters, measured on the WGS84 ellipsoid. */
export function pathDistance(points: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += ellipsoidDistance(points[i - 1], points[i]);
  }
  return total;
}
