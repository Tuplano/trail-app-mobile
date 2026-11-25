type Point = [number, number];

/** How much of each side the rounded corners take, from each end. */
const ROUNDING = 0.2;

function corners(radius: number): Point[] {
  return Array.from({ length: 6 }, (_, k) => {
    const angle = ((-90 + 60 * k) * Math.PI) / 180;
    return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
  });
}

const towards = (p: Point, q: Point, t: number): Point => [
  p[0] + (q[0] - p[0]) * t,
  p[1] + (q[1] - p[1]) * t,
];

/**
 * A hexagon with rounded corners, point up, centred in a 100×100 box, as an
 * SVG path. It starts just right of the top corner and goes clockwise, so a
 * dash along it fills like a clock hand.
 */
export function roundedHexagonPath(radius: number): string {
  const v = corners(radius);
  const f = (p: Point) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  let d = `M ${f(towards(v[0], v[1], ROUNDING))}`;
  for (let i = 1; i <= 6; i++) {
    const corner = v[i % 6];
    d += ` L ${f(towards(corner, v[i - 1], ROUNDING))}`;
    d += ` Q ${f(corner)} ${f(towards(corner, v[(i + 1) % 6], ROUNDING))}`;
  }
  return `${d} Z`;
}

/** The length of that path, for a progress dash: straight parts plus the corner curves. */
export function roundedHexagonLength(radius: number): number {
  const v = corners(radius);
  const a = towards(v[1], v[0], ROUNDING);
  const b = towards(v[1], v[2], ROUNDING);
  // Measure one corner's curve in small straight steps.
  let curve = 0;
  let last = a;
  for (let i = 1; i <= 20; i++) {
    const t = i / 20;
    const p: Point = [
      (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * v[1][0] + t ** 2 * b[0],
      (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * v[1][1] + t ** 2 * b[1],
    ];
    curve += Math.hypot(p[0] - last[0], p[1] - last[1]);
    last = p;
  }
  // Each side is as long as the radius; the corners take ROUNDING from both ends.
  return 6 * (radius * (1 - 2 * ROUNDING) + curve);
}
