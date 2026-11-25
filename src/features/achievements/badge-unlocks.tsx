import { router } from 'expo-router';
import { useEffect } from 'react';

import { useMyBadges } from './achievements-api';
import { BadgeBanner } from './badge-banner';
import type { BadgeNews, NewsDisplay } from './badge-news';
import { checkBadgeNews, markBadgeNewsRead } from './badge-news-check';
import { useBadgeNewsStore } from './badge-news-store';
import { BadgeUnlockedModal } from './badge-unlocked-modal';
import { watchForBadges } from './badge-watch';
import { useMyProgress } from './progress-api';

/** How long the banner stays before giving way to the next one, as in the design. */
const BANNER_MS = 7000;

function check() {
  checkBadgeNews().catch(() => {}); // offline: the next check will find it
}

/**
 * Celebrates badges and new ranks as they unlock (tasks #44, 45.2): looks for new ones on launch,
 * when the app comes to the front and after a hike uploads, then shows the
 * banner and, when it's tapped, the pop-up. A badge push tapped while the
 * app was closed opens the pop-up directly (see usePushNotifications).
 *
 * Sits over every signed-in screen, in the root layout.
 */
export function BadgeUnlocks() {
  const banner = useBadgeNewsStore((s) => (s.open ? null : (s.waiting[0] ?? null)));
  const open = useBadgeNewsStore((s) => s.open);
  const badges = useMyBadges();
  const progress = useMyProgress();

  // The badge's or track's icon, name and xp, once their lists have loaded.
  const display = (news: BadgeNews): NewsDisplay => {
    if (news.kind === 'rank') {
      const track = progress.data?.tracks.find((t) => t.code === news.code);
      const current = track?.current;
      return {
        icon: track?.icon ?? '',
        name: news.title,
        description: news.body,
        xp: current && current.step === news.step ? current.xp : undefined,
      };
    }
    const badge = badges.data?.find((b) => b.code === news.code);
    return {
      icon: badge?.icon ?? '',
      name: badge?.name ?? news.title,
      description: badge?.description ?? news.body,
      xp: badge?.xp,
    };
  };

  useEffect(() => {
    const stop = watchForBadges(check);
    return () => {
      stop();
      // Unmounted on sign out: the next person starts with nothing queued.
      useBadgeNewsStore.getState().reset();
    };
  }, []);

  // Once a banner shows, the unlock counts as seen: mark it read, so it's
  // never announced twice. Then give it a few seconds before the next.
  const bannerId = banner?.notificationId;
  useEffect(() => {
    if (!bannerId) return;
    markBadgeNewsRead(bannerId);
    const timer = setTimeout(() => useBadgeNewsStore.getState().dismissBanner(), BANNER_MS);
    return () => clearTimeout(timer);
  }, [bannerId]);

  const close = () => useBadgeNewsStore.getState().close();

  return (
    <>
      {banner ? (
        <BadgeBanner
          key={banner.notificationId}
          news={banner}
          display={display(banner)}
          onPress={() => useBadgeNewsStore.getState().openBanner()}
        />
      ) : null}
      <BadgeUnlockedModal
        news={open}
        display={open ? display(open) : null}
        onClose={close}
        onView={() => {
          const shown = open;
          close();
          if (shown?.kind === 'rank') {
            router.navigate({ pathname: '/achievements/[track]', params: { track: shown.code } });
          } else {
            router.navigate('/achievements');
          }
        }}
      />
    </>
  );
}
