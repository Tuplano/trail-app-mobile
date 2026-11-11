import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSyncStatusStore } from '@/sync/sync-status-store';

import { useMyBadges } from './achievements-api';
import { BadgeBanner } from './badge-banner';
import { checkBadgeNews, markBadgeNewsRead } from './badge-news-check';
import { useBadgeNewsStore } from './badge-news-store';
import { BadgeUnlockedModal } from './badge-unlocked-modal';

/** How long the banner stays before giving way to the next one, as in the design. */
const BANNER_MS = 7000;

/**
 * After an upload the server needs a moment to work out badges (a few
 * seconds, longer when busy), so look a few times rather than once.
 */
const AFTER_UPLOAD_MS = [4000, 12000, 30000];

function check() {
  checkBadgeNews().catch(() => {}); // offline: the next check will find it
}

/**
 * Celebrates badges as they unlock (task #44): looks for new ones on launch,
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
  const find = (code: string) => badges.data?.find((badge) => badge.code === code);

  useEffect(() => {
    check();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const timers: ReturnType<typeof setTimeout>[] = [];
    const unsubscribe = useSyncStatusStore.subscribe((state, previous) => {
      if (state.lastUploadAt === previous.lastUploadAt) return;
      for (const ms of AFTER_UPLOAD_MS) timers.push(setTimeout(check, ms));
    });
    return () => {
      appState.remove();
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
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
          badge={find(banner.code)}
          onPress={() => useBadgeNewsStore.getState().openBanner()}
        />
      ) : null}
      <BadgeUnlockedModal
        news={open}
        badge={open ? find(open.code) : undefined}
        onClose={close}
        onViewBadges={() => {
          close();
          router.navigate('/profile');
        }}
      />
    </>
  );
}
