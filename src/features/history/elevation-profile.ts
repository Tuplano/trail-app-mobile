import type { PathPoint } from '@/db/track-points';
import { distanceM } from '@/tracking/geo';

/** How many bars the elevation chart has, as in the design. */
export const PROFILE_BARS = 40;

/** Bar heights stay between these fractions of the chart, so the lowest point still shows a bar. */
const MIN_BAR = 0.18;
const MAX_BAR = 0.96;

export type ElevationProfile = {
  /** One height per bar, as a fraction of the chart's height (MIN_BAR to MAX_BAR). */
  bars: number[];
  /** Lowest and highest height along the hike, in meters. */
  minM: number;
  maxM: number;
};

/**
 * The hike's height along the way, for the bar chart on the hike screen.
 *
 * The track is cut into equal stretches of distance (not equal numbers of
 * points: GPS saves fewer points while you stand still), and each bar is the
 * average height of the points in its stretch. A stretch with no point (a
 * gap in GPS) repeats the bar before it. Heights are scaled between the
 * hike's lowest and highest point, so small hills still show their shape.
 *
 * Null when fewer than two points have a height: there's nothing to draw.
 */
export function elevationProfile(
  path: readonly PathPoint[],
  barCount: number = PROFILE_BARS,
): ElevationProfile | null {
  // How far along the track each point is, in meters.
  const along: number[] = [];
  let total = 0;
  path.forEach((point, i) => {
    if (i > 0) total += distanceM(path[i - 1], point);
    along.push(total);
  });

  const withHeight = path
    .map((point, i) => ({ at: along[i], height: point.altitudeM, index: i }))
    .filter((p): p is { at: number; height: number; index: number } => p.height != null);
  if (withHeight.length < 2) return null;

  // A hike that never moved (total 0) is spread by point order instead.
  const position = (p: { at: number; index: number }) =>
    total > 0 ? p.at / total : p.index / Math.max(1, path.length - 1);

  const sums = new Array<number>(barCount).fill(0);
  const counts = new Array<number>(barCount).fill(0);
  for (const p of withHeight) {
    const bar = Math.min(barCount - 1, Math.floor(position(p) * barCount));
    sums[bar] += p.height;
    counts[bar] += 1;
  }

  const heights: number[] = [];
  let previous = withHeight[0].height;
  for (let bar = 0; bar < barCount; bar++) {
    previous = counts[bar] > 0 ? sums[bar] / counts[bar] : previous;
    heights.push(previous);
  }

  const minM = Math.min(...withHeight.map((p) => p.height));
  const maxM = Math.max(...withHeight.map((p) => p.height));
  const range = maxM - minM;
  const bars = heights.map((h) =>
    range > 0 ? MIN_BAR + ((h - minM) / range) * (MAX_BAR - MIN_BAR) : (MIN_BAR + MAX_BAR) / 2,
  );
  return { bars, minM, maxM };
}
