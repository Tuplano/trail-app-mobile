import type { PathPoint } from '@/db/track-points';

type Spot = { x: number; y: number };

/** An SVG drawing of a route: the line (path data), and where it starts and ends. */
export type RouteOutline = { d: string; start: Spot; end: Spot };

/** More points than this add nothing at thumbnail size, so the rest are skipped. */
const MAX_POINTS = 200;

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Fits a route into a `size`×`size` square, `pad` from each edge, for a
 * small picture without a map (the New post card, as in the design). North
 * is up, and longitude is narrowed by cos(latitude) so the shape isn't
 * stretched. Null when there are no points to draw.
 */
export function routeOutline(
  path: readonly PathPoint[],
  size: number,
  pad: number,
): RouteOutline | null {
  if (path.length === 0) return null;
  const step = Math.ceil(path.length / MAX_POINTS);
  // Every step-th point, always keeping the last.
  const points = path.filter((_, i) => i % step === 0 || i === path.length - 1);

  const midLat =
    (Math.min(...points.map((p) => p.lat)) + Math.max(...points.map((p) => p.lat))) / 2;
  const squeeze = Math.cos((midLat * Math.PI) / 180);
  const xs = points.map((p) => p.lng * squeeze);
  const ys = points.map((p) => p.lat);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];

  const inner = size - 2 * pad;
  // The longer side fills the square; a single spot (span 0) sits in the middle.
  const span = Math.max(maxX - minX, maxY - minY);
  const scale = span > 0 ? inner / span : 0;
  const offsetX = pad + (inner - (maxX - minX) * scale) / 2;
  const offsetY = pad + (inner - (maxY - minY) * scale) / 2;

  const spots = points.map((_, i) => ({
    x: round(offsetX + (xs[i] - minX) * scale),
    // SVG's y grows downwards; latitude grows northwards.
    y: round(offsetY + (maxY - ys[i]) * scale),
  }));
  const d = spots.map((s, i) => `${i === 0 ? 'M' : 'L'}${s.x} ${s.y}`).join(' ');
  return { d, start: spots[0], end: spots[spots.length - 1] };
}
