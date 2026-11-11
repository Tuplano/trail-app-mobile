import { formatCount, formatHikeDuration } from '@/features/history/hike-summary';
import { formatKm } from '@/features/record/format';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Shown where the server hasn't worked out a number yet. */
const NO_VALUE = '–';

/**
 * How long ago something was posted, as in the design: "Just now", "12m
 * ago", "3h ago", "Yesterday", then the date ("Mon, Nov 3", with the year
 * once it's not this year). `now` is passed in so tests don't depend on the clock.
 */
export function formatTimeAgo(at: number, now: number): string {
  const ago = now - at;
  if (ago < MINUTE) return 'Just now';
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)}m ago`;

  const then = new Date(at);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  // Within the last day but still today reads better as hours.
  if (at >= startOfToday) return `${Math.floor(ago / HOUR)}h ago`;
  if (at >= startOfToday - 24 * HOUR) return 'Yesterday';

  return then.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(then.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/**
 * A post's three numbers, as in the design: "14.20 km", "1,020 m", "4h 48m".
 * The server fills them in once it has processed the hike; until then "–".
 */
export function feedStats(hike: {
  distanceM: number | null;
  elevationGainM: number | null;
  movingTimeS: number | null;
}): { distance: string; climb: string; time: string } {
  return {
    distance: hike.distanceM == null ? NO_VALUE : `${formatKm(hike.distanceM)} km`,
    climb: hike.elevationGainM == null ? NO_VALUE : `${formatCount(hike.elevationGainM)} m`,
    time: hike.movingTimeS == null ? NO_VALUE : formatHikeDuration(hike.movingTimeS),
  };
}

/**
 * Why your post isn't up yet, after the hike's name on its queued card
 * ("Eagle Point · Waiting for signal", as in the design). Uses the real
 * connection: "Waiting for Wi-Fi" only while off Wi-Fi with photos still to
 * upload, so a post that fails on Wi-Fi doesn't blame the connection.
 */
export function unsentPostNote(post: {
  syncStatus: 'pending' | 'syncing' | 'failed';
  photosToUpload: number;
  failedTries: number;
  online: boolean;
  /** On Wi-Fi; null when not known yet. */
  unmetered: boolean | null;
  photosOnWifiOnly: boolean;
}): string {
  if (post.syncStatus === 'failed') return "The server didn't accept it";
  if (!post.online) return 'Waiting for signal';
  if (post.syncStatus === 'syncing') return 'Uploading…';
  if (post.photosOnWifiOnly && post.photosToUpload > 0 && post.unmetered === false) {
    return 'Waiting for Wi-Fi';
  }
  if (post.failedTries > 0) return "Couldn't upload · trying again";
  return 'Queued for upload';
}
