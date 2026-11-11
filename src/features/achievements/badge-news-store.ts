import { create } from 'zustand';

import type { BadgeNews } from './badge-news';

type BadgeNewsState = {
  /** Unlocks still to announce, oldest first. The first one shows as the banner. */
  waiting: BadgeNews[];
  /** The unlock shown in the celebration pop-up, if open. */
  open: BadgeNews | null;
  /** Ids already queued or shown since the app started, so a re-check never repeats one. */
  seen: Record<string, true>;
  /** Queues newly found unlocks (any already seen are skipped). */
  add: (news: readonly BadgeNews[]) => void;
  /** The banner was tapped: open its pop-up. */
  openBanner: () => void;
  /** The banner timed out: on to the next one. */
  dismissBanner: () => void;
  /** A badge push was tapped: open its pop-up straight away. */
  openFromPush: (news: BadgeNews) => void;
  /** Close or View badges: the next waiting unlock (if any) shows as a banner. */
  close: () => void;
  /** Signed out: forget everything (the next person has their own badges). */
  reset: () => void;
};

/**
 * The design's badge celebration, one unlock at a time: a banner at the top
 * ("Badge unlocked: Century · Your hike synced. Tap to see it."), which
 * opens the pop-up. Unlocks found together (a first hike can earn several)
 * follow one after another.
 */
export const useBadgeNewsStore = create<BadgeNewsState>()((set) => ({
  waiting: [],
  open: null,
  seen: {},

  add: (news) =>
    set((state) => {
      const fresh = news.filter((item) => !state.seen[item.notificationId]);
      if (fresh.length === 0) return state;
      const seen = { ...state.seen };
      for (const item of fresh) seen[item.notificationId] = true;
      return { waiting: [...state.waiting, ...fresh], seen };
    }),

  openBanner: () =>
    set((state) =>
      state.waiting.length === 0
        ? state
        : { open: state.waiting[0], waiting: state.waiting.slice(1) },
    ),

  dismissBanner: () => set((state) => ({ waiting: state.waiting.slice(1) })),

  openFromPush: (news) =>
    set((state) => ({
      open: news,
      waiting: state.waiting.filter((item) => item.notificationId !== news.notificationId),
      seen: { ...state.seen, [news.notificationId]: true },
    })),

  close: () => set({ open: null }),

  reset: () => set({ waiting: [], open: null, seen: {} }),
}));
