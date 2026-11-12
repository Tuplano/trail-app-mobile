import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { queryClient } from '@/api/query-client';

import {
  type NewZoneBody,
  saveZoneDraft,
  sortZones,
  type Zone,
  type ZoneDraft,
} from './privacy-zones';

export const PRIVACY_ZONES_KEY = ['privacy-zones'] as const;

/**
 * Your privacy zones, by name (see sortZones). They live on the server only: the server
 * cuts them out of your routes for everyone else, so there's nothing to keep
 * on the phone.
 */
export function usePrivacyZones() {
  return useQuery({
    queryKey: PRIVACY_ZONES_KEY,
    queryFn: async (): Promise<Zone[]> => {
      const { data, error, response } = await api.GET('/api/v1/privacy-zones');
      if (!data) throw toApiError(error, response);
      return sortZones(data.items);
    },
  });
}

async function createZone(body: NewZoneBody): Promise<Zone> {
  const { data, error, response } = await api.POST('/api/v1/privacy-zones', { body });
  if (!data) throw toApiError(error, response);
  return data;
}

/** Removes a zone. Already gone (404) counts as done. */
async function deleteZone(id: string): Promise<void> {
  const { error, response } = await api.DELETE('/api/v1/privacy-zones/{id}', {
    params: { path: { id } },
  });
  if (!response.ok && response.status !== 404) throw toApiError(error, response);
}

const refreshZones = () => queryClient.invalidateQueries({ queryKey: PRIVACY_ZONES_KEY });

/** Changes the cached list right away, so the screen doesn't wait for the refetch. */
const editCache = (change: (zones: Zone[]) => Zone[]) =>
  queryClient.setQueryData<Zone[]>(PRIVACY_ZONES_KEY, (zones) => zones && sortZones(change(zones)));

/** Saves a new or edited zone (an edit replaces the zone, see saveZoneDraft). */
export function useSaveZone() {
  return useMutation({
    mutationFn: ({ draft, saved }: { draft: ZoneDraft; saved: Zone | undefined }) =>
      saveZoneDraft(draft, saved, { create: createZone, remove: deleteZone }),
    onSuccess: ({ zone, oldRemoved }, { saved }) =>
      editCache((zones) => [
        ...zones.filter((z) => !(oldRemoved && saved && z.id === saved.id)),
        zone,
      ]),
    onSettled: refreshZones,
  });
}

export function useRemoveZone() {
  return useMutation({
    mutationFn: deleteZone,
    onSuccess: (_, id) => editCache((zones) => zones.filter((zone) => zone.id !== id)),
    onSettled: refreshZones,
  });
}
