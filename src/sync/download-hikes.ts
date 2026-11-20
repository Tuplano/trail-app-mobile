import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import type { components } from '@/api/schema';
import {
  type DownloadedHikeInput,
  listHikeIds,
  saveDownloadedHike,
} from '@/db/hikes';
import type { NewTrackPoint } from '@/db/track-points';
import type { Db } from '@/db/types';
import { parseGpx, type GpxPoint } from '@/features/gpx/gpx';
import { computeStats } from '@/tracking/hike-stats';

import { serverStatsOf } from './server-stats';

/** A hike as GET /hikes lists it: the hike plus its post's id, if shared. */
type ServerHike = components['schemas']['HikeListDto']['items'][number];

/** The most GET /hikes gives per page (the API's MAX_HIKES_PER_PAGE). */
const PAGE_SIZE = 50;

/**
 * The server's hikes worth saving on the phone, oldest first: finished ones
 * with a route that the phone doesn't have yet. Left out: hikes still
 * uploading ('recording'), manual ones (typed in, no route to show), and any
 * the phone already has (its own copy always wins).
 */
export function hikesToDownload(
  serverHikes: readonly ServerHike[],
  onPhone: ReadonlySet<string>,
): ServerHike[] {
  return serverHikes
    .filter(
      (hike) =>
        hike.status !== 'recording' &&
        hike.source !== 'manual' &&
        hike.endedAt !== null &&
        !onPhone.has(hike.id),
    )
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

/**
 * The route's points from the server's GPX file, in order. The server writes
 * a time for every point; one without (not expected) is left out, since the
 * phone keeps points by time.
 */
export function pointsFromGpx(points: readonly GpxPoint[]): NewTrackPoint[] {
  return points
    .filter((point): point is GpxPoint & { recordedAt: number } => point.recordedAt !== undefined)
    .map((point) => ({
      recordedAt: point.recordedAt,
      lat: point.lat,
      lng: point.lng,
      altitudeM: point.altitudeM ?? null,
    }));
}

/**
 * A server hike as the phone saves it. Its numbers are the server's final
 * ones once it has processed the hike; until then, the phone works them out
 * from the route (and the server-stats fetch replaces them later).
 */
export function toDownloadedHike(
  hike: ServerHike,
  points: NewTrackPoint[],
  userId: string,
): DownloadedHikeInput {
  const serverStats = serverStatsOf(hike);
  const phoneStats = computeStats(points);
  return {
    id: hike.id,
    userId,
    title: hike.title,
    source: hike.source === 'imported' ? 'imported' : 'recorded',
    visibility: hike.visibility,
    startedAt: Date.parse(hike.startedAt),
    endedAt: Date.parse(hike.endedAt ?? hike.startedAt),
    clientUpdatedAt: Date.parse(hike.clientUpdatedAt),
    stats: serverStats ?? {
      distanceM: phoneStats.distanceM,
      elevationGainM: phoneStats.elevationGainM,
      movingTimeS: phoneStats.movingTimeS,
    },
    statsSource: serverStats ? 'server' : 'phone',
    serverPostId: hike.postId,
    points,
  };
}

/** Every hike of the signed-in account on the server, following the pages. */
async function listServerHikes(): Promise<ServerHike[]> {
  const all: ServerHike[] = [];
  let cursor: string | undefined;
  do {
    const { data, error, response } = await api.GET('/api/v1/hikes', {
      params: { query: { cursor, limit: PAGE_SIZE } },
    });
    if (!data) throw toApiError(error, response);
    all.push(...data.items);
    cursor = data.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

/**
 * Saves the signed-in account's hikes that are on the server but not on
 * this phone (recorded on another phone, before a reinstall, or by an
 * account new to this phone), so History shows them, offline too.
 *
 * At most `limit` routes are downloaded per call, so one sync run stays
 * short; `remaining` says how many are left for the next. A hike the server
 * no longer has is skipped. Throws on a network failure; the next run
 * carries on where this one stopped.
 */
export async function downloadHikes(
  db: Db,
  userId: string,
  limit = 10,
): Promise<{ saved: number; remaining: number }> {
  const missing = hikesToDownload(await listServerHikes(), await listHikeIds(db));
  let saved = 0;
  for (const hike of missing.slice(0, limit)) {
    const { data, error, response } = await api.GET('/api/v1/hikes/{id}/gpx', {
      params: { path: { id: hike.id } },
      parseAs: 'text',
    });
    if (data === undefined) {
      if (response.status === 404) continue; // deleted meanwhile
      throw toApiError(error, response);
    }
    const points = pointsFromGpx(parseGpx(data).points);
    if (points.length === 0) continue; // nothing to show in History
    await saveDownloadedHike(db, toDownloadedHike(hike, points, userId));
    saved++;
  }
  return { saved, remaining: Math.max(0, missing.length - limit) };
}
