import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import type { components } from '@/api/schema';
import { getHike, type Hike, setSyncStatus } from '@/db/hikes';
import type { OutboxItem } from '@/db/outbox';
import { countTrackPoints, getTrackPoints } from '@/db/track-points';
import type { Db } from '@/db/types';

import { GiveUpError, isPermanent } from './retry';
import type { UploadProgress } from './sync-status-store';

/** The API takes at most this many points per request. */
export const POINTS_PER_CHUNK = 500;

type UpsertHikeBody = components['schemas']['UpsertHikeDto'];
type ErrorBody = components['schemas']['ErrorResponse'];

const iso = (ms: number) => new Date(ms).toISOString();

/** The hike as the API's PUT /hikes/{id} expects it. */
export function toUpsertBody(hike: Hike): UpsertHikeBody {
  return {
    title: hike.title,
    // Private until the hiker shares it and picks who can see it.
    visibility: hike.visibility,
    startedAt: iso(hike.startedAt),
    endedAt: hike.endedAt == null ? null : iso(hike.endedAt),
    clientUpdatedAt: iso(hike.clientUpdatedAt),
  };
}

/** Told how far an upload has got, so the history can show it; null once it stops. */
export type ReportProgress = (progress: UploadProgress | null) => void;

/**
 * Sends the hike's points from `fromSeq` to `toSeq` (inclusive), 500 per
 * request, calling `onSent` with the count after each request the server took.
 */
async function sendPoints(
  db: Db,
  hikeId: string,
  fromSeq: number,
  toSeq: number,
  onSent: (count: number) => void = () => {},
): Promise<void> {
  for (let seq = fromSeq; seq <= toSeq; ) {
    const limit = Math.min(POINTS_PER_CHUNK, toSeq - seq + 1);
    const points = await getTrackPoints(db, hikeId, seq, limit);
    if (points.length === 0) return;
    const sent = await api.POST('/api/v1/hikes/{id}/points', {
      params: { path: { id: hikeId } },
      body: { points },
    });
    if (!sent.data) throw toApiError(sent.error, sent.response);
    seq += points.length;
    onSent(points.length);
  }
}

/**
 * Uploads one finished hike:
 *
 * 1. PUT /hikes/{id}: create (or update) the hike under the id made on the phone.
 * 2. GET /hikes/{id}/sync-status: ask how many points the server already has
 *    (from an earlier, interrupted upload), and send only the rest, 500 at a time.
 * 3. POST /hikes/{id}/finish: tell the server how many points there are. If it
 *    still lacks some, it lists the missing ranges: send just those and finish
 *    once more.
 *
 * Every step is safe to repeat. Throws on failure: GiveUpError when retrying
 * can never work (the hike is marked 'failed'), anything else to retry later.
 * `report` hears how many points the server has so far ("600 / 1,488").
 */
export async function uploadHike(
  db: Db,
  item: OutboxItem,
  report: ReportProgress = () => {},
): Promise<void> {
  const hike = await getHike(db, item.entityId);
  if (!hike) return; // deleted on the phone: nothing to upload, so it's done

  const params = { path: { id: hike.id } };
  await setSyncStatus(db, hike.id, 'syncing');
  try {
    const created = await api.PUT('/api/v1/hikes/{id}', { params, body: toUpsertBody(hike) });
    if (!created.data) throw toApiError(created.error, created.response);

    const status = await api.GET('/api/v1/hikes/{id}/sync-status', { params });
    if (!status.data) throw toApiError(status.error, status.response);
    const totalPoints = await countTrackPoints(db, hike.id);
    const resumeFrom = (status.data.highestContinuousSeq ?? -1) + 1;
    // Counts from what the server already has, so a resumed upload doesn't start at 0.
    let sent = Math.min(resumeFrom, totalPoints);
    report({ hikeId: hike.id, sent, total: totalPoints });
    await sendPoints(db, hike.id, resumeFrom, totalPoints - 1, (count) => {
      sent += count;
      report({ hikeId: hike.id, sent, total: totalPoints });
    });

    const finish = () =>
      api.POST('/api/v1/hikes/{id}/finish', { params, body: { totalPoints } });
    let finished = await finish();
    const missing = (finished.error as ErrorBody | undefined)?.error.missingRanges;
    if (!finished.data && missing?.length) {
      for (const range of missing) await sendPoints(db, hike.id, range.from, range.to);
      finished = await finish();
    }
    if (!finished.data) throw toApiError(finished.error, finished.response);

    await setSyncStatus(db, hike.id, 'synced');
  } catch (error) {
    if (isPermanent(error)) {
      await setSyncStatus(db, hike.id, 'failed'); // won't be queued again
      throw new GiveUpError(error);
    }
    await setSyncStatus(db, hike.id, 'pending'); // the outbox retries it later
    throw error;
  } finally {
    report(null);
  }
}
