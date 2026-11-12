// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

import type { ElevationChange, TrackPoint } from './types';

/**
 * GPS altitude wobbles by 10 m or more, so a change only counts once it is
 * this big. A simulated hike with phone-like height noise overcounted a 500 m
 * climb by ~900 m at 3 m and ~200 m at 10 m.
 */
export const ELEVATION_STEP_M = 10;

/**
 * Total climb and descent, in meters, ignoring GPS altitude noise.
 *
 * Altitude only counts once it has moved at least `thresholdM` away from the
 * last counted altitude. Without this, a phone sitting still and reporting
 * 100, 101, 100, 101... would rack up meters of fake climbing.
 */
export function elevationChange(
  points: readonly Pick<TrackPoint, 'altitudeM'>[],
  thresholdM = ELEVATION_STEP_M,
): ElevationChange {
  let gainM = 0;
  let lossM = 0;
  let reference: number | undefined;

  for (const { altitudeM } of points) {
    if (altitudeM == null) continue;

    if (reference === undefined) {
      reference = altitudeM;
      continue;
    }

    const diff = altitudeM - reference;
    if (Math.abs(diff) >= thresholdM) {
      if (diff > 0) gainM += diff;
      else lossM -= diff;
      reference = altitudeM;
    }
  }

  return { gainM, lossM };
}
