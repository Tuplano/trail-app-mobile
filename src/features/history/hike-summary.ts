import type { Hike, HistoryHike } from '@/db/hikes';
import { formatKm } from '@/features/record/format';
import type { SyncSnapshot } from '@/sync/sync-status-store';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The hike's name. Hikes don't get a title until the hiker can name them
 * (a later task), so until then it's named after the time of day it started,
 * which is easier to tell apart in a list than a date alone.
 */
export function hikeTitle(hike: Pick<Hike, 'title' | 'startedAt'>): string {
  const title = hike.title?.trim();
  if (title) return title;
  const hour = new Date(hike.startedAt).getHours();
  if (hour >= 5 && hour < 12) return 'Morning hike';
  if (hour >= 12 && hour < 17) return 'Afternoon hike';
  if (hour >= 17 && hour < 21) return 'Evening hike';
  return 'Night hike';
}

/** Clock time on a 12-hour clock: "8:05 AM", "12:30 PM". */
export function formatClockTime(ms: number): string {
  const d = new Date(ms);
  const hours = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * When the hike started, in the phone's time zone, as the design writes it:
 * "Today · 2:14 PM", "Yesterday · 8:05 AM", "Thu, Nov 6 · 7:12 AM", and with
 * the year once it's not this year ("Mon, Mar 3, 2025 · 9:00 AM").
 */
export function formatHikeDate(startedAt: number, now: number = Date.now()): string {
  const time = formatClockTime(startedAt);
  const day = startOfDay(startedAt);
  const today = startOfDay(now);
  if (day === today) return `Today · ${time}`;
  // One calendar day back. Not "today minus 24 h": a daylight saving change
  // makes some days 23 or 25 hours long.
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === yesterday.getTime()) return `Yesterday · ${time}`;

  const d = new Date(startedAt);
  const date = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const year = d.getFullYear() === new Date(now).getFullYear() ? '' : `, ${d.getFullYear()}`;
  return `${date}${year} · ${time}`;
}

/**
 * How long a hike took, as the design writes it in the history: "4h 12m",
 * "36m". Rounded to the minute (seconds don't matter for a hike), and the
 * rounding is done before splitting, so 59.6 minutes is "1h 0m", not "60m".
 */
export function formatHikeDuration(seconds: number): string {
  const minutes = Math.round(Math.max(0, seconds) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Whole numbers with thousands separators: 1488 → "1,488". */
export function formatCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const plural = (n: number, one: string, many: string) =>
  `${formatCount(n)} ${n === 1 ? one : many}`;

/** The line under the History title: "3 hikes · 25.30 km". */
export function summarizeHistory(hikes: readonly Pick<Hike, 'distanceM'>[]): string {
  const meters = hikes.reduce((sum, hike) => sum + hike.distanceM, 0);
  return `${plural(hikes.length, 'hike', 'hikes')} · ${formatKm(meters)} km`;
}

export type SyncChip = 'pending' | 'uploading' | 'synced' | 'failed';

/** How one hike's upload shows in the history: a chip, a note under the stats, maybe Retry. */
export type HikeSyncView = {
  chip: SyncChip;
  note: string;
  /** Show the note as an error. */
  problem: boolean;
  /** Show a Retry button on the row. */
  canRetry: boolean;
};

/**
 * Turns a hike's upload state into what its history row shows. `online` is
 * null until the first network check; then it's treated as online.
 */
export function describeHikeSync(
  hike: Pick<HistoryHike, 'syncStatus' | 'pointCount'>,
  online: boolean | null,
): HikeSyncView {
  switch (hike.syncStatus) {
    case 'pending':
      return {
        chip: 'pending',
        note: online === false ? 'Saved on phone · uploads when online' : 'Queued for upload',
        problem: false,
        canRetry: false,
      };
    case 'syncing':
      return { chip: 'uploading', note: 'Uploading points…', problem: false, canRetry: false };
    case 'synced':
      return {
        chip: 'synced',
        note: plural(hike.pointCount, 'track point', 'track points'),
        problem: false,
        canRetry: false,
      };
    case 'failed':
      return {
        chip: 'failed',
        note: "The server didn't accept it · still saved on this phone",
        problem: true,
        // Retry can't do anything offline.
        canRetry: online !== false,
      };
  }
}

/** The strip above the list while hikes wait to upload, or null when none wait. */
export type OutboxView = { icon: 'offline' | 'syncing' | 'queued'; label: string };

export function describeOutbox(
  s: Pick<SyncSnapshot, 'waiting' | 'syncing' | 'online'>,
): OutboxView | null {
  if (s.waiting === 0) return null;
  if (s.online === false) {
    return { icon: 'offline', label: `${s.waiting} waiting for signal · will upload automatically` };
  }
  if (s.syncing) return { icon: 'syncing', label: `Syncing ${plural(s.waiting, 'hike', 'hikes')}…` };
  return { icon: 'queued', label: `${s.waiting} in outbox` };
}
