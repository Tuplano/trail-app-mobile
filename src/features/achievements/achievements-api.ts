import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import type { components } from '@/api/schema';

export type MyStats = components['schemas']['StatsDto'];
export type Badge = components['schemas']['MyAchievementsDto']['items'][number];

export const MY_STATS_KEY = ['me-stats'] as const;
export const MY_BADGES_KEY = ['me-achievements'] as const;

/**
 * Your totals, xp and level. The server works them out after it processes a
 * hike, a little after the upload, so the Profile tab asks again on focus.
 */
export function useMyStats() {
  return useQuery({
    queryKey: MY_STATS_KEY,
    queryFn: async (): Promise<MyStats> => {
      const { data, error, response } = await api.GET('/api/v1/me/stats');
      if (!data) throw toApiError(error, response);
      return data;
    },
  });
}

/** Every badge, unlocked or not, with your progress on each; grouped by type, easiest first. */
export function useMyBadges() {
  return useQuery({
    queryKey: MY_BADGES_KEY,
    queryFn: async (): Promise<Badge[]> => {
      const { data, error, response } = await api.GET('/api/v1/me/achievements');
      if (!data) throw toApiError(error, response);
      return data.items;
    },
  });
}
