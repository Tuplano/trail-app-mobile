import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import { createHike, deleteHike, getHike, setHikeStatus } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import type { OutboxItem } from '@/db/outbox';
import { createTestDb } from '@/db/__tests__/test-db';
import { addTrackPoints } from '@/db/track-points';

import { GiveUpError } from '../retry';
import { POINTS_PER_CHUNK, toUpsertBody, uploadHike } from '../upload-hike';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));
// The API is faked: each call answers like openapi-fetch ({ data } or { error, response }).
jest.mock('@/api/client', () => ({ api: { PUT: jest.fn(), GET: jest.fn(), POST: jest.fn() } }));

const put = jest.mocked(api.PUT);
const get = jest.mocked(api.GET);
const post = jest.mocked(api.POST);
const ok = (data: unknown = {}) => ({ data, error: undefined, response: new Response() }) as never;
const fail = (status: number, code: string, message: string, extra: object = {}) =>
  ({
    data: undefined,
    error: { error: { code, message, ...extra } },
    response: new Response(null, { status }),
  }) as never;

/** The server already has seq 0..highest (null: none yet). */
const serverHas = (highest: number | null) => get.mockResolvedValue(ok({ highestContinuousSeq: highest }));

/** The fake POST's calls, as plain [path, options] pairs. */
const postCalls = () =>
  post.mock.calls as unknown as [string, { body: { points: { seq: number }[]; totalPoints: number } }][];
/** Each points request as [first seq, last seq]. */
const sentRanges = () =>
  postCalls()
    .filter(([path]) => path === '/api/v1/hikes/{id}/points')
    .map(([, init]) => [init.body.points[0].seq, init.body.points.at(-1)!.seq]);
const finishCalls = () => postCalls().filter(([path]) => path === '/api/v1/hikes/{id}/finish');

async function finishedHike(pointCount: number) {
  const db = createTestDb();
  await prepareDatabase(db);
  const hike = await createHike(db, Date.UTC(2026, 10, 9, 6, 0, 0));
  const points = Array.from({ length: pointCount }, (_, i) => ({
    recordedAt: hike.startedAt + i * 5000,
    lat: 14.6 + i * 0.0001,
    lng: 121.0,
    altitudeM: 100,
    accuracyM: 5,
    speedMps: 1.2,
  }));
  await addTrackPoints(db, hike.id, points);
  await setHikeStatus(db, hike.id, 'finished', hike.startedAt + 3_600_000);
  const item: OutboxItem = {
    id: 1,
    kind: 'hike',
    entityId: hike.id,
    attempts: 0,
    lastError: null,
    nextAttemptAt: 0,
    createdAt: 0,
  };
  return { db, hike, item };
}

const syncStatus = async (db: Awaited<ReturnType<typeof finishedHike>>['db'], id: string) =>
  (await getHike(db, id))!.syncStatus;

beforeEach(() => {
  jest.clearAllMocks();
  put.mockResolvedValue(ok());
  serverHas(null);
  post.mockResolvedValue(ok());
});

describe('toUpsertBody', () => {
  it('sends times as ISO strings and keeps the hike private', async () => {
    const { db, hike } = await finishedHike(1);
    const saved = (await getHike(db, hike.id))!;
    expect(toUpsertBody(saved)).toEqual({
      title: null,
      visibility: 'private',
      startedAt: '2026-11-09T06:00:00.000Z',
      endedAt: '2026-11-09T07:00:00.000Z',
      clientUpdatedAt: expect.stringMatching(/^2026-11-09T07:00:00/),
    });
  });
});

describe('uploadHike', () => {
  it('creates the hike, sends all points in chunks of 500, then finishes it', async () => {
    const { db, hike, item } = await finishedHike(1201);

    await uploadHike(db, item);

    expect(put).toHaveBeenCalledWith('/api/v1/hikes/{id}', {
      params: { path: { id: hike.id } },
      body: expect.objectContaining({ visibility: 'private' }),
    });
    expect(sentRanges()).toEqual([
      [0, POINTS_PER_CHUNK - 1],
      [500, 999],
      [1000, 1200],
    ]);
    expect(finishCalls().map(([, init]) => init.body.totalPoints)).toEqual([1201]);
    expect(await syncStatus(db, hike.id)).toBe('synced');
  });

  it('resumes after the points the server already has', async () => {
    const { db, item } = await finishedHike(1201);
    serverHas(699); // an earlier upload got 0..699 through

    await uploadHike(db, item);

    expect(sentRanges()).toEqual([
      [700, 1199],
      [1200, 1200],
    ]);
  });

  it('sends no points when the server has them all, and just finishes', async () => {
    const { db, item } = await finishedHike(10);
    serverHas(9);
    await uploadHike(db, item);
    expect(sentRanges()).toEqual([]);
    expect(finishCalls()).toHaveLength(1);
  });

  it('sends just the missing ranges when finish reports gaps, then finishes again', async () => {
    const { db, hike, item } = await finishedHike(1000);
    serverHas(999);
    let finishes = 0;
    post.mockImplementation(async (path) => {
      if (path !== '/api/v1/hikes/{id}/finish') return ok();
      finishes++;
      return finishes === 1
        ? fail(409, 'POINTS_MISSING', 'Points are missing', {
            missingRanges: [
              { from: 3, to: 4 },
              { from: 600, to: 600 },
            ],
          })
        : ok();
    });

    await uploadHike(db, item);

    expect(sentRanges()).toEqual([
      [3, 4],
      [600, 600],
    ]);
    expect(finishCalls()).toHaveLength(2);
    expect(await syncStatus(db, hike.id)).toBe('synced');
  });

  it('retries later when points are still missing after the resend', async () => {
    const { db, hike, item } = await finishedHike(10);
    post.mockImplementation(async (path) =>
      path === '/api/v1/hikes/{id}/finish'
        ? fail(409, 'POINTS_MISSING', 'Points 3-4 are missing', {
            missingRanges: [{ from: 3, to: 4 }],
          })
        : ok(),
    );

    const error = await uploadHike(db, item).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(GiveUpError);
    expect(await syncStatus(db, hike.id)).toBe('pending');
  });

  it('retries later after a server error or no connection', async () => {
    const { db, hike, item } = await finishedHike(10);
    put.mockResolvedValue(fail(503, 'UNAVAILABLE', 'Server busy'));
    await expect(uploadHike(db, item)).rejects.toBeInstanceOf(ApiError);
    expect(post).not.toHaveBeenCalled();
    expect(await syncStatus(db, hike.id)).toBe('pending');

    put.mockRejectedValue(new TypeError('Network request failed'));
    await expect(uploadHike(db, item)).rejects.toThrow('Network request failed');
  });

  it("gives up when the server says the hike isn't this user's", async () => {
    const { db, hike, item } = await finishedHike(10);
    put.mockResolvedValue(fail(404, 'HIKE_NOT_FOUND', 'Hike not found'));

    await expect(uploadHike(db, item)).rejects.toBeInstanceOf(GiveUpError);
    expect(await syncStatus(db, hike.id)).toBe('failed');
  });

  it('gives up when the server rejects the data', async () => {
    const { db, hike, item } = await finishedHike(10);
    post.mockResolvedValue(fail(400, 'VALIDATION_FAILED', 'points.3.lat is invalid'));

    await expect(uploadHike(db, item)).rejects.toBeInstanceOf(GiveUpError);
    expect(await syncStatus(db, hike.id)).toBe('failed');
  });

  it('treats a hike deleted on the phone as done', async () => {
    const { db, hike, item } = await finishedHike(10);
    await deleteHike(db, hike.id);
    await expect(uploadHike(db, item)).resolves.toBeUndefined();
    expect(put).not.toHaveBeenCalled();
  });
});
