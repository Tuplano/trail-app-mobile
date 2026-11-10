import type { Hike, SyncStatus } from '@/db/hikes';

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

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * When the hike was, in the phone's time zone: "Today", "Yesterday",
 * "Tue, 10 Nov", or with the year once it's not this year ("Mon, 3 Mar 2025").
 */
export function formatHikeDate(startedAt: number, now: number = Date.now()): string {
  const day = startOfDay(startedAt);
  const today = startOfDay(now);
  if (day === today) return 'Today';
  // One calendar day back. Not "today minus 24 h": a daylight saving change
  // makes some days 23 or 25 hours long.
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === yesterday.getTime()) return 'Yesterday';

  const d = new Date(startedAt);
  const date = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear() ? date : `${date} ${d.getFullYear()}`;
}

/** Clock time on a 12-hour clock: "8:05 AM", "12:30 PM". */
export function formatClockTime(ms: number): string {
  const d = new Date(ms);
  const hours = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/**
 * How long the hike took, start to finish, in seconds. Includes pauses, like
 * the Time on the Record screen, so the two show the same number.
 */
export function hikeDurationS(hike: Pick<Hike, 'startedAt' | 'endedAt'>): number {
  return hike.endedAt == null ? 0 : Math.max(0, (hike.endedAt - hike.startedAt) / 1000);
}

/** What a hike's upload badge shows. Tones match the sync status card. */
export type UploadBadge = { label: string; tone: 'done' | 'waiting' | 'problem' };

const UPLOAD_BADGES: Record<SyncStatus, UploadBadge> = {
  pending: { label: 'Waiting to upload', tone: 'waiting' },
  syncing: { label: 'Uploading…', tone: 'waiting' },
  synced: { label: 'Uploaded', tone: 'done' },
  failed: { label: "Couldn't upload", tone: 'problem' },
};

export function describeUpload(status: SyncStatus): UploadBadge {
  return UPLOAD_BADGES[status];
}
