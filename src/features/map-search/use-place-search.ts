import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { MIN_QUERY_LENGTH, photonUrl, type Place, toPlaces } from './place-search';

/** Wait this long after the last key before searching (Photon is a shared free service). */
const TYPING_PAUSE_MS = 400;

/** `value`, but only once it has stopped changing for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * Places matching what's typed, nearest to `getNear()` ([longitude,
 * latitude]) first. It's read when the search runs, so moving the map
 * doesn't search again.
 */
export function usePlaceSearch(query: string, getNear: () => [number, number] | null) {
  const q = useSettled(query.trim(), TYPING_PAUSE_MS);
  const typing = q !== query.trim();

  const search = useQuery({
    queryKey: ['place-search', q],
    enabled: q.length >= MIN_QUERY_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
    // A failed search is retried by typing; don't hit the service again by itself.
    retry: false,
    queryFn: async ({ signal }): Promise<Place[]> => {
      const response = await fetch(photonUrl(q, getNear()), {
        signal,
        // A plain app name, as the service asks; nothing about the person.
        headers: { 'User-Agent': 'Trailing-mobile' },
      });
      if (!response.ok) throw new Error(`Place search failed (${response.status})`);
      return toPlaces(await response.json());
    },
  });

  return { ...search, isFetching: search.isFetching || typing };
}
