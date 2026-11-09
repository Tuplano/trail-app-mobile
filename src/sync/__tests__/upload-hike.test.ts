import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import { createHike, deleteHike, getHike, setHikeStatus } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import type { OutboxItem } from '@/db/outbox';
import { createTestDb } from '@/db/__tests__/test-db';
import { addTrackPoints } from '@/db/track-points';

import { POINTS_PER_CHUNK, toUpsertBody, uploadHike } from '../upload-hike';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));
// The API is faked: each call answers like openapi-fetch ({ data } or { error, response }).
jest.mock('@/api/client', () => ({ api: { PUT: jest.fn(), POST: jest.fn() } }));

const put = jest.mocked(api.PUT);
const post = jest.mocked(api.POST);
/** The fake POST's calls, as plain [path, options] pairs. */
const postCalls = () =>
  post.mock.calls as unknown as [string, { body: { points: { seq: number }[] } }][];
const pointChunks = () =>
  postCalls()
    .filter(([path]) => path === '/api/v1/hikes/{id}/points')
    .map(([, init]) => init.body.points);
const ok = (data: unknown = {}) => ({ data, error: undefined, response: new Response() }) as never;
const fail = (status: number, code: string, message: string) =>
  ({
    data: undefined,
    error: { error: { code, message } },
    response: new Response(null, { status }),
  }) as never;

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

beforeEach(() => {
  jest.clearAllMocks();
  put.mockResolvedValue(ok());
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
  it('creates the hike, sends points in chunks of 500, then finishes it', async () => {
    const { db, hike, item } = await finishedHike(1201);

    await uploadHike(db, item);

    expect(put).toHaveBeenCalledWith('/api/v1/hikes/{id}', {
      params: { path: { id: hike.id } },
      body: expect.objectContaining({ visibility: 'private' }),
    });
    const chunks = pointChunks();
    expect(chunks.map((c) => c.length)).toEqual([POINTS_PER_CHUNK, POINTS_PER_CHUNK, 201]);
    expect(chunks[1][0].seq).toBe(500);
    expect(chunks[2].at(-1)!.seq).toBe(1200);

    expect(post).toHaveBeenLastCalledWith('/api/v1/hikes/{id}/finish', {
      params: { path: { id: hike.id } },
      body: { totalPoints: 1201 },
    });
    expect((await getHike(db, hike.id))!.syncStatus).toBe('synced');
  });

  it('sends exactly one chunk for exactly 500 points', async () => {
    const { db, item } = await finishedHike(500);
    await uploadHike(db, item);
    expect(pointChunks()).toHaveLength(1);
    expect(post).toHaveBeenLastCalledWith('/api/v1/hikes/{id}/finish', expect.anything());
  });

  it('stops and throws when a step fails, leaving the hike to retry', async () => {
    const { db, hike, item } = await finishedHike(10);
    put.mockResolvedValue(fail(500, 'INTERNAL', 'Server error'));

    await expect(uploadHike(db, item)).rejects.toBeInstanceOf(ApiError);
    expect(post).not.toHaveBeenCalled();
    expect((await getHike(db, hike.id))!.syncStatus).toBe('pending');
  });

  it('throws when the server says points are missing at finish', async () => {
    const { db, hike, item } = await finishedHike(10);
    post.mockImplementation(async (path) =>
      path === '/api/v1/hikes/{id}/finish'
        ? fail(409, 'POINTS_MISSING', 'Points 3-4 are missing')
        : ok(),
    );

    await expect(uploadHike(db, item)).rejects.toThrow('Points 3-4 are missing');
    expect((await getHike(db, hike.id))!.syncStatus).toBe('pending');
  });

  it('passes a network failure on, so the outbox retries', async () => {
    const { db, item } = await finishedHike(10);
    put.mockRejectedValue(new TypeError('Network request failed'));
    await expect(uploadHike(db, item)).rejects.toThrow('Network request failed');
  });

  it('treats a hike deleted on the phone as done', async () => {
    const { db, hike, item } = await finishedHike(10);
    await deleteHike(db, hike.id);
    await expect(uploadHike(db, item)).resolves.toBeUndefined();
    expect(put).not.toHaveBeenCalled();
  });
});
