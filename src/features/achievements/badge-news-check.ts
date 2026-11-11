import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { queryClient } from '@/api/query-client';

import { MY_BADGES_KEY, MY_STATS_KEY } from './achievements-api';
import { unreadBadgeNews } from './badge-news';
import { useBadgeNewsStore } from './badge-news-store';

/**
 * Asks the API for badges unlocked since they were last shown (unread
 * notifications) and queues them for the banner. Profile's level card and
 * badges are refreshed too, since they changed. Throws when offline; it's
 * simply tried again on the next check.
 */
export async function checkBadgeNews(): Promise<void> {
  const { data, error, response } = await api.GET('/api/v1/notifications', {
    params: { query: { limit: 20 } },
  });
  if (!data) throw toApiError(error, response);
  const news = unreadBadgeNews(data.items);
  if (news.length === 0) return;
  useBadgeNewsStore.getState().add(news);
  void queryClient.invalidateQueries({ queryKey: MY_STATS_KEY });
  void queryClient.invalidateQueries({ queryKey: MY_BADGES_KEY });
}

/** Once shown, an unlock is read: it won't be announced again, here or on another phone. */
export function markBadgeNewsRead(notificationId: string): void {
  // Offline: it may show once more later, which is harmless.
  api.POST('/api/v1/notifications/read', { body: { ids: [notificationId] } }).catch(() => {});
}
