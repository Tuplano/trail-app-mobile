// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

// Plain TypeScript with no NestJS imports, so this folder can be copied into
// the mobile app for live stats while recording.

/** A position in degrees (WGS84, the same as SRID 4326 in PostGIS). */
export interface LatLng {
  lat: number;
  lng: number;
}

/** One GPS fix from a recording or a GPX file. */
export interface TrackPoint extends LatLng {
  /** Meters above sea level. Missing (or null) when the device or file has no altitude. */
  altitudeM?: number | null;
  /** GPS time in epoch milliseconds. */
  recordedAt?: number;
}

export interface ElevationChange {
  gainM: number;
  lossM: number;
}
