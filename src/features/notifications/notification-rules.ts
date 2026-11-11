/**
 * Whether the app may show notifications:
 * - 'on': allowed.
 * - 'ask': not decided yet, so the phone can still show its "Allow" prompt.
 * - 'off': refused. The phone won't ask again, so only its Settings can change it.
 */
export type NotificationAccess = 'on' | 'ask' | 'off';

export function notificationAccess(permission: {
  granted: boolean;
  canAskAgain: boolean;
}): NotificationAccess {
  if (permission.granted) return 'on';
  return permission.canAskAgain ? 'ask' : 'off';
}

/** The kinds of notification the API sends (trail-app-api NOTIFICATION_TYPES). */
const PROFILE_NEWS = new Set(['achievement_unlocked', 'level_up']);

/**
 * What a notification is about, from the data the API puts in it:
 * `{ type, notificationId, code, hikeId }` for a badge,
 * `{ type, notificationId, level }` for a new level. Returns null for
 * anything else (an older or newer kind the app doesn't know).
 *
 * Both kinds open Profile, where the level card and badges are. The badge
 * unlock screen (task #44) will open in its place for a badge.
 */
export function notificationTarget(
  data: unknown,
): { href: '/profile'; notificationId: string | null } | null {
  if (typeof data !== 'object' || data === null) return null;
  const { type, notificationId } = data as Record<string, unknown>;
  if (typeof type !== 'string' || !PROFILE_NEWS.has(type)) return null;
  return {
    href: '/profile',
    notificationId: typeof notificationId === 'string' ? notificationId : null,
  };
}
