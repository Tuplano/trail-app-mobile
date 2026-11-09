/** Pace needs some distance to mean anything; below this it shows a dash. */
export const MIN_PACE_DISTANCE_M = 100;

const pad = (n: number) => String(n).padStart(2, '0');

/** 59 s → "0:59", 754 s → "12:34", 4530 s → "1:15:30". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Meters as kilometers with two decimals: 1234.5 → "1.23". */
export function formatKm(meters: number): string {
  return (Math.max(0, meters) / 1000).toFixed(2);
}

/** Whole meters: 152.6 → "153". */
export function formatMeters(meters: number): string {
  return String(Math.round(Math.max(0, meters)));
}

/**
 * Average moving pace as minutes per km, e.g. "12:30". A dash until there's
 * enough distance and moving time for the number to be meaningful.
 */
export function formatPace(movingTimeS: number, distanceM: number): string {
  if (distanceM < MIN_PACE_DISTANCE_M || movingTimeS <= 0) return '–';
  return formatDuration(movingTimeS / (distanceM / 1000));
}
