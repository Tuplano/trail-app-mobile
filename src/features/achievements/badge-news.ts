import { formatCount } from '@/features/history/hike-summary';

/**
 * A badge the hiker just unlocked and hasn't been shown yet. Comes from the
 * API's notifications: the title is "Badge unlocked: Century" and the body the
 * badge's description, so the banner can show without the badge list.
 */
export type BadgeNews = {
  notificationId: string;
  code: string;
  title: string;
  body: string;
};

/** A notification as GET /notifications lists it (only what this needs). */
type ApiNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

/**
 * The unread badge unlocks among the hiker's notifications, oldest first, so
 * they're celebrated in the order they happened. Level-ups and anything
 * already read are left out.
 */
export function unreadBadgeNews(items: readonly ApiNotification[]): BadgeNews[] {
  return items
    .filter((item) => item.type === 'achievement_unlocked' && item.readAt === null)
    .filter((item) => typeof item.data.code === 'string')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => ({
      notificationId: item.id,
      code: item.data.code as string,
      title: item.title,
      body: item.body,
    }));
}

/**
 * The badge in a tapped push, from what the API puts in it:
 * `{ type: 'achievement_unlocked', notificationId, code }`. Null for any
 * other push (a level-up opens Profile instead).
 */
export function badgeNewsFromPush(content: {
  title: string | null;
  body: string | null;
  data?: unknown;
}): BadgeNews | null {
  if (typeof content.data !== 'object' || content.data === null) return null;
  const { type, notificationId, code } = content.data as Record<string, unknown>;
  if (type !== 'achievement_unlocked') return null;
  if (typeof notificationId !== 'string' || typeof code !== 'string') return null;
  return { notificationId, code, title: content.title ?? '', body: content.body ?? '' };
}

/** The design's "+150 XP" chip; nothing for a badge worth no bonus. */
export function bonusXpLabel(xp: number | undefined): string {
  return xp && xp > 0 ? `+${formatCount(xp)} XP` : '';
}
