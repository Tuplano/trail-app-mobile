import { formatCount } from '@/features/history/hike-summary';

/** The level card, as in the design: "Level 7", "2,340 / 3,000 XP", the bar, "660 XP to level 8". */
export type LevelProgress = {
  title: string;
  xpLabel: string;
  /** How full the bar is, 0 to 1, within the current level. */
  fraction: number;
  toGo: string;
};

/**
 * The level card's words and bar from the server's numbers. The bar fills
 * from where this level started to where the next one starts. At the top
 * level there's no next one: the bar is full. (The API has no level names
 * yet, so the design's "· Trailblazer" is left out.)
 */
export function levelProgress(stats: {
  xp: number;
  level: number;
  levelMinXp: number;
  nextLevelMinXp: number | null;
}): LevelProgress {
  const { xp, level, levelMinXp, nextLevelMinXp } = stats;
  const title = `Level ${level}`;
  if (nextLevelMinXp === null) {
    return { title, xpLabel: `${formatCount(xp)} XP`, fraction: 1, toGo: 'Top level reached' };
  }
  const span = nextLevelMinXp - levelMinXp;
  const fraction = span > 0 ? Math.min(1, Math.max(0, (xp - levelMinXp) / span)) : 1;
  return {
    title,
    xpLabel: `${formatCount(xp)} / ${formatCount(nextLevelMinXp)} XP`,
    fraction,
    toGo: `${formatCount(Math.max(0, nextLevelMinXp - xp))} XP to level ${level + 1}`,
  };
}

/** What a badge needs from it to show its progress. */
type BadgeProgress = {
  type: string;
  threshold: number | null;
  progress: number | null;
  unlockedAt: string | null;
};

/**
 * The small progress line under a locked badge, as in the design ("3/5",
 * "25/100"): kilometers for distance, meters for climbing, otherwise a count
 * (hikes, weeks); from 10,000 up in thousands ("11.6k/20k") to fit the cell.
 * Nothing once it's unlocked, or for a peak (no count).
 */
export function badgeProgressLabel(badge: BadgeProgress): string {
  if (badge.unlockedAt || badge.threshold === null || badge.progress === null) return '';
  const done = Math.min(badge.progress, badge.threshold);
  if (badge.type === 'total_distance') {
    return `${short(Math.floor(done / 1000))}/${short(badge.threshold / 1000)}`;
  }
  return `${short(Math.floor(done))}/${short(badge.threshold)}`;
}

/** Big numbers shortened to fit under a badge: 4,210 stays, 11,621 → "11.6k", 20,000 → "20k". */
function short(n: number): string {
  if (n < 10_000) return formatCount(n);
  return `${(Math.floor(n / 100) / 10).toString()}k`;
}

/** "6 of 12", beside the Badges heading. */
export function badgeCountLabel(badges: readonly { unlockedAt: string | null }[]): string {
  return `${badges.filter((badge) => badge.unlockedAt).length} of ${badges.length}`;
}

/** The design's three profile stats: HIKES, KM, CLIMB · M. */
export function profileStats(stats: {
  hikeCount: number;
  totalDistanceM: number;
  totalElevationGainM: number;
}): { label: string; value: string }[] {
  return [
    { label: 'HIKES', value: formatCount(stats.hikeCount) },
    { label: 'KM', value: formatCount(Math.floor(stats.totalDistanceM / 1000)) },
    { label: 'CLIMB · M', value: formatCount(stats.totalElevationGainM) },
  ];
}
