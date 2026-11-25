import { formatCount } from '@/features/history/hike-summary';
import { medals, type MedalMaterial } from '@/theme/tokens';

type Metric = 'distance' | 'climb' | 'hikes' | 'active_weeks';

/**
 * The number alone, in the unit the track is read in: km, m, or a count.
 * Rounded down for what you've done, up for what's left, so neither claims
 * more than is true ("86.99 km to go" reads 87 km).
 */
function amount(metric: Metric, value: number, round: 'down' | 'up' = 'down'): string {
  const whole = round === 'up' ? Math.ceil : Math.floor;
  if (metric === 'distance') {
    const km = value / 1000;
    // Short distances keep a decimal, so a first walk doesn't read "0 km".
    if (km < 10) return String(whole(Math.round(km * 1e6) / 1e5) / 10);
    return formatCount(whole(km));
  }
  return formatCount(whole(value));
}

function unit(metric: Metric, value: number): string {
  switch (metric) {
    case 'distance':
      return 'km';
    case 'climb':
      return 'm';
    case 'hikes':
      return value === 1 ? 'hike' : 'hikes';
    case 'active_weeks':
      return value === 1 ? 'week' : 'weeks';
  }
}

/** A track's value in words: "63 km", "5,361 m", "1 hike", "12 weeks". */
export function formatMetric(metric: Metric, value: number, round: 'down' | 'up' = 'down'): string {
  return `${amount(metric, value, round)} ${unit(metric, value)}`;
}

/** A step's name with its extra title, if any: "Gold · Everest". */
export function stepTitle(step: { name: string; title: string | null }): string {
  return step.title ? `${step.name} · ${step.title}` : step.name;
}

/** Where a track's progress bar and its words come from. */
export type TrackProgress = {
  /** The rank reached: "Silver", "Prestige II", or "No rank yet". */
  rank: string;
  /** How full the bar is, 0 to 1, from the step reached to the next. */
  fraction: number;
  /** "63 / 150 km" */
  amount: string;
  /** "87 km to Gold" */
  toGo: string;
  /** "+100 XP", the next step's bonus. */
  reward: string;
};

/**
 * A track's card: the rank reached, and the way to the next step. The bar
 * fills from the step reached (0 before the first) to the next, so it
 * starts empty after every rank-up. There is always a next step.
 */
export function trackProgress(track: {
  metric: Metric;
  value: number;
  current: { name: string; title: string | null; threshold: number } | null;
  next: { name: string; title: string | null; threshold: number; xp: number };
}): TrackProgress {
  const { metric, value, current, next } = track;
  const from = current?.threshold ?? 0;
  const span = next.threshold - from;
  const fraction = span > 0 ? Math.min(1, Math.max(0, (value - from) / span)) : 1;
  return {
    rank: current ? stepTitle(current) : 'No rank yet',
    fraction,
    amount: `${amount(metric, value)} / ${formatMetric(metric, next.threshold)}`,
    toGo: `${formatMetric(metric, Math.max(0, next.threshold - value), 'up')} to ${next.name}`,
    reward: next.xp > 0 ? `+${formatCount(next.xp)} XP` : '',
  };
}

/** 1 → "I", 14 → "XIV": prestige reads like a title. Digits from 4,000. */
export function romanNumeral(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n >= 4000) return String(n);
  const table: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  for (const [value, letters] of table) {
    while (n >= value) {
      out += letters;
      n -= value;
    }
  }
  return out;
}

/**
 * The colours for a rank code from the API. Null for no rank (a locked
 * emblem) or a rank the app doesn't know yet, which then shows in the
 * app's accent colours.
 */
export function medalMaterial(rankCode: string | null | undefined): MedalMaterial | null {
  if (!rankCode) return null;
  return (medals as Record<string, MedalMaterial>)[rankCode] ?? null;
}

/** "2 Nov 2026", for when a step was reached. */
export function formatUnlockDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
