// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

import { pathDistance } from './distance';
import { BAROMETER_STEP_M, ELEVATION_STEP_M, elevationChange } from './elevation';
import { filterWithReport, type GpsFix, type Jump } from './filter';
import { fuseHeights, type HeightSource } from './heights';
import { movingTime } from './moving';
import { smoothAltitudes } from './smooth';
import { collapseStops } from './stops';
import { thinPoints } from './thin';

/** A recorded fix as both the API and the app store it. */
export interface HikeFix extends GpsFix {
  altitudeM?: number | null;
  /** Air pressure from the phone's barometer, in hPa; null without one. */
  pressureHpa?: number | null;
}

/** What a hike adds up to, from its fixes. */
export interface HikeStats {
  distanceM: number;
  /** Time spent moving, in seconds; rests don't count. */
  movingTimeS: number;
  /** First kept fix to last, in seconds. */
  durationS: number;
  elevationGainM: number;
  elevationLossM: number;
  /** Highest altitude among the kept fixes; null when none had one. */
  maxAltitudeM: number | null;
  /** Whether the climb came from the barometer or from the altitudes. */
  heightSource: HeightSource;
}

/**
 * The one set of rules that turns a hike's GPS fixes into its numbers. The
 * API runs it when it processes a hike; the app runs the same code (a copy
 * made by its `npm run sync:geo`) for the live numbers while recording, so
 * the two always agree.
 *
 * In order: take heights from the barometer when the hike has its readings
 * (heights.ts), drop inaccurate fixes and impossible jumps (filterWithReport),
 * turn each stop into one spot so resting adds no distance (stops.ts),
 * average out height wobble (smooth.ts), drop steps too small to be real
 * (thinPoints), then measure what's left. A barometer is steady enough for
 * climb to count in smaller steps than GPS or map heights allow. Returns the kept fixes too (they
 * make the route) and the jumps (the API's anti-cheat checks look at them).
 */
export function computeHikeStats<T extends HikeFix>(
  fixes: readonly T[],
): { stats: HikeStats; kept: T[]; jumps: Jump[] } {
  // Before the filter: a fix too inaccurate to place still has a good pressure.
  const heights = fuseHeights(fixes);
  const { kept: filtered, jumps } = filterWithReport(heights.fixes);
  const kept = thinPoints(smoothAltitudes(collapseStops(filtered)));
  const step = heights.source === 'barometer' ? BAROMETER_STEP_M : ELEVATION_STEP_M;
  const { gainM, lossM } = elevationChange(kept, step);

  let maxAltitudeM: number | null = null;
  for (const { altitudeM } of kept) {
    if (altitudeM != null && (maxAltitudeM === null || altitudeM > maxAltitudeM)) {
      maxAltitudeM = altitudeM;
    }
  }
  const first = kept.at(0);
  const last = kept.at(-1);

  return {
    stats: {
      distanceM: pathDistance(kept),
      movingTimeS: movingTime(kept),
      durationS: first && last ? (last.recordedAt - first.recordedAt) / 1000 : 0,
      elevationGainM: gainM,
      elevationLossM: lossM,
      maxAltitudeM,
      heightSource: heights.source,
    },
    kept,
    jumps,
  };
}
