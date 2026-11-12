// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

import { haversineDistance } from './distance';
import type { LatLng } from './types';

/** A recorded fix, with what the filter needs to judge it. */
export interface GpsFix extends LatLng {
  /** GPS time in epoch milliseconds. */
  recordedAt: number;
  /** Horizontal accuracy in meters. Null or missing when unknown. */
  accuracyM?: number | null;
}

export interface FilterOptions {
  /** Fixes less accurate than this (a bigger number) are dropped. */
  maxAccuracyM?: number;
  /** Fixes that would need a faster move than this are dropped. */
  maxSpeedMps?: number;
}

/** Worse than this is a guess, not a position. */
export const MAX_ACCURACY_M = 30;
/** 36 km/h: well above a hiker running downhill, below a GPS teleport. */
export const MAX_SPEED_MPS = 10;

// Two fixes with the same or a backwards clock still get one second between
// them, so a duplicate fix a few meters away isn't read as infinite speed.
const MIN_ELAPSED_S = 1;
// After this many rejected fixes in a row that agree with each other, the
// last kept fix was the wrong one: follow them instead.
const RESYNC_AFTER = 5;

/** A fix that jumped further than anyone could have moved. */
export interface Jump {
  /** How far it was from the last good fix, in meters. */
  distanceM: number;
  /** The speed that jump would have needed, in m/s. */
  speedMps: number;
}

/**
 * Drops GPS fixes that are too inaccurate or that jump too far to be real.
 * Expects fixes in recording order and returns the kept ones in that order,
 * as the same objects, so extra fields such as `seq` survive.
 *
 * A fix is judged against the last one kept, so a single spike is dropped
 * and the track carries on from where it was. If the first kept fix was the
 * wrong one, the real track would look like an endless jump away from it; the
 * resync rule handles that, though the wrong fix itself stays in the result.
 */
export function filterBadPoints<T extends GpsFix>(
  points: readonly T[],
  options: FilterOptions = {},
): T[] {
  return filterWithReport(points, options).kept;
}

/**
 * The same as filterBadPoints, and also reports every jump it met: each
 * spike it threw away, and each time the track moved somewhere else and
 * stayed there (counted once, not once per fix). A few spikes are normal GPS
 * trouble; many large ones are a sign of a faked track.
 */
export function filterWithReport<T extends GpsFix>(
  points: readonly T[],
  {
    maxAccuracyM = MAX_ACCURACY_M,
    maxSpeedMps = MAX_SPEED_MPS,
  }: FilterOptions = {},
): { kept: T[]; jumps: Jump[] } {
  const kept: T[] = [];
  const jumps: Jump[] = [];
  let anchor: T | undefined;
  // Fixes the speed check rejected, each reachable from the one before it,
  // and the jump each one made.
  let stray: T[] = [];
  let strayJumps: Jump[] = [];

  const seconds = (from: T, to: T) =>
    Math.max((to.recordedAt - from.recordedAt) / 1000, MIN_ELAPSED_S);
  const reachable = (from: T, to: T) =>
    haversineDistance(from, to) / seconds(from, to) <= maxSpeedMps;
  const jumpFrom = (from: T, to: T): Jump => {
    const distanceM = haversineDistance(from, to);
    return { distanceM, speedMps: distanceM / seconds(from, to) };
  };
  // The fixes waiting were spikes after all: the track went on without them.
  const dropStray = () => {
    jumps.push(...strayJumps);
    stray = [];
    strayJumps = [];
  };

  for (const point of points) {
    if (point.accuracyM != null && point.accuracyM > maxAccuracyM) continue;

    if (!anchor || reachable(anchor, point)) {
      dropStray();
      kept.push(point);
      anchor = point;
      continue;
    }

    const last = stray.at(-1);
    if (last && reachable(last, point)) {
      stray.push(point);
      strayJumps.push(jumpFrom(anchor, point));
    } else {
      dropStray();
      stray = [point];
      strayJumps = [jumpFrom(anchor, point)];
    }
    if (stray.length >= RESYNC_AFTER) {
      kept.push(...stray);
      anchor = stray.at(-1);
      // One move to somewhere else, however many fixes it took to settle.
      jumps.push(strayJumps[0]);
      stray = [];
      strayJumps = [];
    }
  }
  dropStray();
  return { kept, jumps };
}
