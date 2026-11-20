import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import type { components } from '@/api/schema';
import { listHikesAwaitingServerStats, saveServerStats, type ServerStats } from '@/db/hikes';
import type { Db } from '@/db/types';

type ServerHike = Pick<
  components['schemas']['HikeDto'],
  'status' | 'distanceM' | 'movingTimeS' | 'elevationGainM'
>;

/**
 * The server's final numbers for a hike, or null while it hasn't processed
 * it yet (it works them out a few seconds after the upload finishes).
 */
export function serverStatsOf(hike: ServerHike): ServerStats | null {
  if (hike.status !== 'processed' || hike.distanceM == null || hike.movingTimeS == null) {
    return null;
  }
  return {
    distanceM: hike.distanceM,
    movingTimeS: hike.movingTimeS,
    // Null when the hike had no heights at all: nothing was climbed that we know of.
    elevationGainM: hike.elevationGainM ?? 0,
  };
}

/**
 * For the account's uploaded hikes still showing the phone's estimate, asks
 * the server for its final numbers and saves them on the phone, so the
 * history and the hike screen show them, offline too.
 *
 * Returns how many hikes got their final numbers, and how many the server
 * hasn't processed yet (worth asking again shortly). A hike the server
 * doesn't know (deleted there) is skipped. Throws on a network failure; the
 * next sync run asks again.
 */
export async function fetchServerStats(
  db: Db,
  userId: string,
): Promise<{ updated: number; notReady: number }> {
  let updated = 0;
  let notReady = 0;
  for (const id of await listHikesAwaitingServerStats(db, userId)) {
    const { data, error, response } = await api.GET('/api/v1/hikes/{id}', {
      params: { path: { id } },
    });
    if (!data) {
      if (response.status === 404) continue;
      throw toApiError(error, response);
    }
    const stats = serverStatsOf(data);
    if (stats) {
      await saveServerStats(db, id, stats);
      updated++;
    } else {
      notReady++;
    }
  }
  return { updated, notReady };
}
