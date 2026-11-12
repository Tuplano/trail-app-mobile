// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:
// change it in the API, then run the sync again.

import { pathDistance } from './distance';
import { elevationChange } from './elevation';
import { filterWithReport, type GpsFix, type Jump } from './filter';
import { movingTime } from './moving';
import { smoothAltitudes } from './smooth';
import { collapseStops } from './stops';
import { thinPoints } from './thin';

/** A recorded fix as both the API and the app store it. */
export interface HikeFix extends GpsFix {
  altitudeM?: number | null;
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
}

/**
 * The one set of rules that turns a hike's GPS fixes into its numbers. The
 * API runs it when it processes a hike; the app runs the same code (a copy
 * made by its `npm run sync:geo`) for the live numbers while recording, so
 * the two always agree.
 *
 * In order: drop inaccurate fixes and impossible jumps (filterWithReport),
 * turn each stop into one spot so resting adds no distance (stops.ts),
 * average out GPS height wobble (smooth.ts), drop steps too small to be real
 * (thinPoints), then measure what's left. Returns the kept fixes too (they
 * make the route) and the jumps (the API's anti-cheat checks look at them).
 */
export function computeHikeStats<T extends HikeFix>(
  fixes: readonly T[],
): { stats: HikeStats; kept: T[]; jumps: Jump[] } {
  const { kept: filtered, jumps } = filterWithReport(fixes);
  const kept = thinPoints(smoothAltitudes(collapseStops(filtered)));
  const { gainM, lossM } = elevationChange(kept);

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
    },
    kept,
    jumps,
  };
}
