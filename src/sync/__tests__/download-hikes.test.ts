import { api } from '@/api/client';
import type { components } from '@/api/schema';
import { createHike, getHike, listFinishedHikes } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { countPending, enqueueUnsyncedHikes } from '@/db/outbox';
import { createTestDb } from '@/db/__tests__/test-db';
import { getTrackPath } from '@/db/track-points';
import { toGpx } from '@/features/gpx/gpx';

import { downloadHikes, hikesToDownload, pointsFromGpx, toDownloadedHike } from '../download-hikes';

const USER = 'user-1';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));
// The API is faked: each call answers like openapi-fetch ({ data } or { error, response }).
jest.mock('@/api/client', () => ({ api: { GET: jest.fn() } }));

type ServerHike = components['schemas']['HikeListDto']['items'][number];

/** A hike as GET /hikes lists it: finished and processed unless told otherwise. */
function serverHike(id: string, startedAt: number, overrides: Partial<ServerHike> = {}): ServerHike {
  return {
    id,
    userId: USER,
    title: `Hike ${id}`,
    notes: null,
    status: 'processed',
    visibility: 'private',
    source: 'recorded',
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(startedAt + 3_600_000).toISOString(),
    clientUpdatedAt: new Date(startedAt + 3_600_000).toISOString(),
    totalPoints: 3,
    distanceM: 5120,
    durationS: 3600,
    movingTimeS: 3000,
    elevationGainM: 312,
    elevationLossM: 300,
    maxAltitudeM: 2900,
    flagReason: null,
    postId: null,
    createdAt: new Date(startedAt).toISOString(),
    updatedAt: new Date(startedAt).toISOString(),
    ...overrides,
  };
}

/** The route the server's GPX file has: three timed points with heights. */
const route = (startedAt: number) => [
  { recordedAt: startedAt, lat: 16.59, lng: 120.89, altitudeM: 2500 },
  { recordedAt: startedAt + 60_000, lat: 16.591, lng: 120.891, altitudeM: 2510 },
  { recordedAt: startedAt + 120_000, lat: 16.592, lng: 120.892, altitudeM: 2525 },
];

const get = jest.mocked(api.GET);
const ok = (data: unknown) => ({ data, error: undefined, response: new Response() }) as never;
const fail = (status: number) =>
  ({ data: undefined, error: {}, response: new Response(null, { status }) }) as never;

/** Answers GET /hikes with `hikes` (in pages of 2) and each GPX with its route. */
function fakeServer(hikes: ServerHike[], missingGpx: string[] = []) {
  get.mockImplementation((async (path: string, init: { params: Record<string, Record<string, unknown>> }) => {
    if (path === '/api/v1/hikes') {
      const start = Number(init.params.query.cursor ?? 0);
      const next = start + 2 < hikes.length ? String(start + 2) : null;
      return ok({ items: hikes.slice(start, start + 2), nextCursor: next });
    }
    const id = String(init.params.path.id);
    if (missingGpx.includes(id)) return fail(404);
    const hike = hikes.find((h) => h.id === id)!;
    return ok(toGpx({ name: hike.title ?? undefined, points: route(Date.parse(hike.startedAt)) }));
  }) as never);
}

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

beforeEach(() => jest.clearAllMocks());

describe('hikesToDownload', () => {
  it("picks finished hikes with a route the phone doesn't have, oldest first", () => {
    const hikes = [
      serverHike('newer', 3000),
      serverHike('older', 1000),
      serverHike('on-phone', 2000),
      serverHike('uploading', 4000, { status: 'recording', endedAt: null }),
      serverHike('typed-in', 5000, { source: 'manual' }),
    ];
    expect(hikesToDownload(hikes, new Set(['on-phone'])).map((h) => h.id)).toEqual([
      'older',
      'newer',
    ]);
  });
});

describe('pointsFromGpx', () => {
  it('keeps timed points in order and leaves out any without a time', () => {
    expect(
      pointsFromGpx([
        { lat: 1, lng: 2, altitudeM: 10, recordedAt: 100 },
        { lat: 1.1, lng: 2.1 },
        { lat: 1.2, lng: 2.2, recordedAt: 200 },
      ]),
    ).toEqual([
      { recordedAt: 100, lat: 1, lng: 2, altitudeM: 10 },
      { recordedAt: 200, lat: 1.2, lng: 2.2, altitudeM: null },
    ]);
  });
});

describe('toDownloadedHike', () => {
  it("uses the server's final numbers once it has processed the hike", () => {
    const saved = toDownloadedHike(serverHike('h', 1000), pointsFromGpx(route(1000)), USER);
    expect(saved).toMatchObject({
      userId: USER,
      statsSource: 'server',
      stats: { distanceM: 5120, elevationGainM: 312, movingTimeS: 3000 },
    });
  });

  it('works the numbers out from the route while the server is still processing', () => {
    const saved = toDownloadedHike(
      serverHike('h', 1000, { status: 'finished', distanceM: null, movingTimeS: null }),
      pointsFromGpx(route(1000)),
      USER,
    );
    expect(saved.statsSource).toBe('phone');
    expect(saved.stats.distanceM).toBeGreaterThan(0);
  });
});

describe('downloadHikes', () => {
  it('fills History with the server hikes missing on the phone, as uploaded', async () => {
    const db = await freshDb();
    const own = await createHike(db, USER, 2000); // recorded on this phone
    fakeServer([serverHike('from-server', 1000), serverHike(own.id, 2000)]);

    expect(await downloadHikes(db, USER)).toEqual({ saved: 1, remaining: 0 });

    const history = await listFinishedHikes(db, USER);
    expect(history.map((h) => h.id)).toEqual(['from-server']);
    expect(await getHike(db, 'from-server')).toMatchObject({
      title: 'Hike from-server',
      syncStatus: 'synced',
      statsSource: 'server',
      distanceM: 5120,
    });
    expect(await getTrackPath(db, 'from-server')).toHaveLength(3);
    // Already on the server: nothing queues it for upload.
    expect(await enqueueUnsyncedHikes(db, USER)).toBe(0);
    expect(await countPending(db, USER)).toBe(0);
    // The phone's own hike isn't fetched again.
    expect(get).not.toHaveBeenCalledWith('/api/v1/hikes/{id}/gpx', {
      params: { path: { id: own.id } },
      parseAs: 'text',
    });
  });

  it('remembers when a downloaded hike was already shared, so it is not shared twice', async () => {
    const db = await freshDb();
    const postId = '01a1f7bd-e798-77ea-bd7b-546691fa8eb0';
    fakeServer([serverHike('shared', 1000, { postId }), serverHike('not-shared', 2000)]);

    await downloadHikes(db, USER);

    expect((await getHike(db, 'shared'))?.serverPostId).toBe(postId);
    expect((await getHike(db, 'not-shared'))?.serverPostId).toBeNull();
  });

  it('downloads a few routes per call and says how many are left', async () => {
    const db = await freshDb();
    fakeServer([1, 2, 3, 4, 5].map((n) => serverHike(`h${n}`, n * 1000)));

    expect(await downloadHikes(db, USER, 2)).toEqual({ saved: 2, remaining: 3 });
    expect(await downloadHikes(db, USER, 2)).toEqual({ saved: 2, remaining: 1 });
    expect(await downloadHikes(db, USER, 2)).toEqual({ saved: 1, remaining: 0 });
    expect(await listFinishedHikes(db, USER)).toHaveLength(5);
  });

  it('skips a hike deleted on the server meanwhile', async () => {
    const db = await freshDb();
    fakeServer([serverHike('gone', 1000), serverHike('kept', 2000)], ['gone']);

    expect(await downloadHikes(db, USER)).toEqual({ saved: 1, remaining: 0 });
    expect((await listFinishedHikes(db, USER)).map((h) => h.id)).toEqual(['kept']);
  });

  it('saves nothing and throws when the server is unreachable, to carry on later', async () => {
    const db = await freshDb();
    get.mockRejectedValue(new TypeError('Network request failed'));

    await expect(downloadHikes(db, USER)).rejects.toThrow();
    expect(await listFinishedHikes(db, USER)).toEqual([]);
  });
});
