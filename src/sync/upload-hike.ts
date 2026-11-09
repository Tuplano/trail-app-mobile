import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import type { components } from '@/api/schema';
import { getHike, type Hike, setSyncStatus } from '@/db/hikes';
import type { OutboxItem } from '@/db/outbox';
import { getTrackPoints } from '@/db/track-points';
import type { Db } from '@/db/types';

/** The API takes at most this many points per request. */
export const POINTS_PER_CHUNK = 500;

type UpsertHikeBody = components['schemas']['UpsertHikeDto'];

const iso = (ms: number) => new Date(ms).toISOString();

/** The hike as the API's PUT /hikes/{id} expects it. */
export function toUpsertBody(hike: Hike): UpsertHikeBody {
  return {
    title: hike.title,
    // Who can see it is chosen when posting (Stage 5); until then it's private.
    visibility: 'private',
    startedAt: iso(hike.startedAt),
    endedAt: hike.endedAt == null ? null : iso(hike.endedAt),
    clientUpdatedAt: iso(hike.clientUpdatedAt),
  };
}

/**
 * Uploads one finished hike, in the three steps the API asks for:
 *
 * 1. PUT /hikes/{id}: create (or update) the hike under the id made on the phone.
 * 2. POST /hikes/{id}/points: send the points in chunks of 500, oldest first.
 * 3. POST /hikes/{id}/finish: tell the server how many points there are, so it
 *    can check it has them all and work out the hike's stats.
 *
 * Every step is safe to repeat (same id, points the server has are skipped,
 * repeating finish is fine), so after a failure the whole upload is simply
 * tried again. Throws on failure; the outbox then schedules a retry.
 */
export async function uploadHike(db: Db, item: OutboxItem): Promise<void> {
  const hike = await getHike(db, item.entityId);
  if (!hike) return; // deleted on the phone: nothing to upload, so it's done

  await setSyncStatus(db, hike.id, 'syncing');
  try {
    const path = { params: { path: { id: hike.id } } };

    const created = await api.PUT('/api/v1/hikes/{id}', { ...path, body: toUpsertBody(hike) });
    if (!created.data) throw toApiError(created.error, created.response);

    let totalPoints = 0;
    for (let fromSeq = 0; ; fromSeq += POINTS_PER_CHUNK) {
      const points = await getTrackPoints(db, hike.id, fromSeq, POINTS_PER_CHUNK);
      if (points.length === 0) break;
      const sent = await api.POST('/api/v1/hikes/{id}/points', { ...path, body: { points } });
      if (!sent.data) throw toApiError(sent.error, sent.response);
      totalPoints += points.length;
      if (points.length < POINTS_PER_CHUNK) break;
    }

    const finished = await api.POST('/api/v1/hikes/{id}/finish', {
      ...path,
      body: { totalPoints },
    });
    if (!finished.data) throw toApiError(finished.error, finished.response);

    await setSyncStatus(db, hike.id, 'synced');
  } catch (error) {
    await setSyncStatus(db, hike.id, 'pending'); // the outbox retries it later
    throw error;
  }
}
