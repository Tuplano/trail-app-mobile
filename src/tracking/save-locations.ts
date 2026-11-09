import type { LocationObject } from 'expo-location';

import { getRecordingHike } from '@/db/hikes';
import { addTrackPoints, getLastTrackPoint, type NewTrackPoint } from '@/db/track-points';
import type { Db } from '@/db/types';

import { filterPoints } from './point-filter';

/** A fix from expo-location in the shape track_points stores. */
export function toTrackPoint(location: LocationObject): NewTrackPoint {
  const { latitude, longitude, altitude, accuracy, speed } = location.coords;
  return {
    recordedAt: location.timestamp,
    lat: latitude,
    lng: longitude,
    altitudeM: altitude,
    accuracyM: accuracy,
    // Some devices report -1 when they don't know the speed.
    speedMps: speed != null && speed >= 0 ? speed : null,
  };
}

/**
 * Saves a batch of fixes from the background location task to the hike being
 * recorded, oldest first. Returns how many were saved: 0 when no hike is
 * recording (paused or finished), because fixes can still arrive just after.
 *
 * Fixes from before the hike started are dropped: when GPS turns on, Android
 * can first hand over its last known position, which may be minutes old and
 * somewhere else entirely. So are inaccurate fixes and ones too close to the
 * last saved point.
 */
export async function saveLocations(db: Db, locations: readonly LocationObject[]): Promise<number> {
  if (locations.length === 0) return 0;
  const hike = await getRecordingHike(db);
  if (!hike) return 0;

  const fresh = locations
    .filter((l) => l.timestamp >= hike.startedAt)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(toTrackPoint);
  if (fresh.length === 0) return 0;

  // Drop inaccurate fixes and GPS wobble (see point-filter.ts).
  const points = filterPoints(fresh, await getLastTrackPoint(db, hike.id));
  if (points.length === 0) return 0;
  await addTrackPoints(db, hike.id, points);
  return points.length;
}
