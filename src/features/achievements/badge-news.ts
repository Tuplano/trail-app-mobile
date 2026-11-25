import { formatCount } from '@/features/history/hike-summary';

/**
 * A badge or a new rank the hiker just reached and hasn't been shown yet.
 * Comes from the API's notifications: the title is "Badge unlocked: Century"
 * or "Distance: Gold", the body says what it took, so the banner can show
 * without loading anything else.
 */
export type BadgeNews = {
  notificationId: string;
  /** A badge, or a step on a rank track. */
  kind: 'badge' | 'rank';
  /** The badge's code, or the track's code for a rank. */
  code: string;
  title: string;
  body: string;
  /** For a rank: its code ('gold'), for the medal's finish. */
  rank: string | null;
  /** For a rank: the step reached, and its Prestige number (0 before). */
  step: number;
  prestige: number;
};

/**
 * How a piece of news is shown in the banner and pop-up, filled in from the
 * badge or track lists once they load (the notification's words until then).
 */
export type NewsDisplay = {
  icon: string;
  name: string;
  description: string;
  /** Bonus xp, when known. */
  xp: number | undefined;
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
 * Badge or rank news from a notification's type and data (the same in the
 * list and in a push), or null for anything else: a level-up, a kind this
 * app doesn't know, or data missing what it needs.
 */
function newsFrom(
  notificationId: string,
  type: unknown,
  data: Record<string, unknown>,
  words: { title: string; body: string },
): BadgeNews | null {
  if (type === 'achievement_unlocked' && typeof data.code === 'string') {
    return {
      notificationId,
      kind: 'badge',
      code: data.code,
      ...words,
      rank: null,
      step: 0,
      prestige: 0,
    };
  }
  if (type === 'rank_up' && typeof data.track === 'string') {
    return {
      notificationId,
      kind: 'rank',
      code: data.track,
      ...words,
      rank: typeof data.rank === 'string' ? data.rank : null,
      step: typeof data.step === 'number' ? data.step : 0,
      prestige: typeof data.prestige === 'number' ? data.prestige : 0,
    };
  }
  return null;
}

/**
 * The unread badge and rank news among the hiker's notifications, oldest
 * first, so they're celebrated in the order they happened. Level-ups and
 * anything already read are left out.
 */
export function unreadBadgeNews(items: readonly ApiNotification[]): BadgeNews[] {
  return (
    [...items]
      .filter((item) => item.readAt === null)
      // Unlocks from one hike share a time; their ids (UUIDv7) keep the
      // server's order, which puts the biggest news first.
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .flatMap((item) => {
        const news = newsFrom(item.id, item.type, item.data, {
          title: item.title,
          body: item.body,
        });
        return news ? [news] : [];
      })
  );
}

/**
 * The badge or rank in a tapped push, from what the API puts in it: the
 * notification's data plus `type` and `notificationId`. Null for any other
 * push (a level-up opens Profile instead).
 */
export function badgeNewsFromPush(content: {
  title: string | null;
  body: string | null;
  data?: unknown;
}): BadgeNews | null {
  if (typeof content.data !== 'object' || content.data === null) return null;
  const data = content.data as Record<string, unknown>;
  if (typeof data.notificationId !== 'string') return null;
  return newsFrom(data.notificationId, data.type, data, {
    title: content.title ?? '',
    body: content.body ?? '',
  });
}

/** The design's "+150 XP" chip; nothing for a badge worth no bonus. */
export function bonusXpLabel(xp: number | undefined): string {
  return xp && xp > 0 ? `+${formatCount(xp)} XP` : '';
}
