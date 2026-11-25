import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import type { components } from '@/api/schema';

export type MyProgress = components['schemas']['MyProgressDto'];
export type Track = MyProgress['tracks'][number];
export type TrackStep = Track['next'];
export type Unlock = MyProgress['recent'][number];
export type TrackLadder = components['schemas']['TrackLadderDto'];
export type LadderStep = TrackLadder['steps'][number];
export type HikeRewards = components['schemas']['HikeRewardsDto'];

export const MY_PROGRESS_KEY = ['me-progress'] as const;
export const trackLadderKey = (code: string) => ['me-progress', 'track', code] as const;
export const hikeRewardsKey = (hikeId: string) => ['hike-rewards', hikeId] as const;

/**
 * Your level, rank on every track and latest unlocks. Worked out on the
 * server a little after a hike uploads, so screens ask again on focus.
 */
export function useMyProgress() {
  return useQuery({
    queryKey: MY_PROGRESS_KEY,
    queryFn: async (): Promise<MyProgress> => {
      const { data, error, response } = await api.GET('/api/v1/me/progress');
      if (!data) throw toApiError(error, response);
      return data;
    },
  });
}

/** One track's whole ladder: every named step, and one past where you are. */
export function useTrackLadder(code: string) {
  return useQuery({
    queryKey: trackLadderKey(code),
    queryFn: async (): Promise<TrackLadder> => {
      const { data, error, response } = await api.GET('/api/v1/me/progress/tracks/{code}', {
        params: { path: { code } },
      });
      if (!data) throw toApiError(error, response);
      return data;
    },
  });
}

/**
 * What one of your hikes earned. Only asked for once the hike is uploaded:
 * before that the server doesn't have it.
 */
export function useHikeRewards(hikeId: string, enabled: boolean) {
  return useQuery({
    queryKey: hikeRewardsKey(hikeId),
    enabled,
    queryFn: async (): Promise<HikeRewards> => {
      const { data, error, response } = await api.GET('/api/v1/hikes/{id}/rewards', {
        params: { path: { id: hikeId } },
      });
      if (!data) throw toApiError(error, response);
      return data;
    },
  });
}
