import { api } from '@/api/client';
import { createHike, getHike, setHikeStatus } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { countPending, enqueueUnsyncedHikes, makeAllDue } from '@/db/outbox';
import { createPost, getPost, listUnsentPosts } from '@/db/posts';
import { createTestDb } from '@/db/__tests__/test-db';
import { addTrackPoints, type TrackPoint } from '@/db/track-points';
import type { Db } from '@/db/types';
import { unsentNotInFeed } from '@/features/feed/feed-cache';

import { uploadPhotoFile } from '../photo-files';
import { processOutbox } from '../process-outbox';
import { uploadHike } from '../upload-hike';
import { uploadPost } from '../upload-post';

/*
 * Task #41: a hike is finished and shared with no signal (on the trail, in
 * airplane mode). Once the phone is back online the post must reach the
 * server exactly once, after its hike, and the feed must show it once: from
 * the server, no longer as the phone's "Queued" copy.
 *
 * The phone side is real (SQLite, outbox, uploadHike, uploadPost). The server
 * is a small fake following the real API's rules (trail-app-api): points are
 * stored once per seq, a post needs its finished hike, and creating a post
 * with an id it already has returns that post instead of making another.
 */

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) =>
    new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));
jest.mock('@/api/client', () => ({ api: { PUT: jest.fn(), GET: jest.fn(), POST: jest.fn() } }));
jest.mock('../photo-files', () => ({ uploadPhotoFile: jest.fn(), deletePhotoFile: jest.fn() }));

const POINTS = 40;

/** How a request fails: 'before' it reaches the server, or 'after' (done, reply lost). */
type Cut = 'before' | 'after';

type ServerPost = { id: string; hikeId: string; caption: string | null; photoKeys: string[] };

type FakeServer = {
  hikeFinished: boolean;
  points: Set<number>;
  /** Posts by id, in the order they were created. */
  posts: Map<string, ServerPost>;
  /** Photo files that reached storage, by key. */
  stored: Set<string>;
  /** Every POST /posts the phone sent, repeats included. */
  postRequests: number;
  /** Requests so far, and which ones lose the connection. */
  requests: number;
  cuts: Map<number, Cut>;
  /** False while the phone has no signal: every request fails before leaving. */
  online: boolean;
};

let server: FakeServer;
let clock: number;
let links: number;

const ok = (data: unknown = {}) => ({ data, error: undefined, response: new Response() });
const refuse = (status: number, code: string) => ({
  data: undefined,
  error: { error: { code, message: code } },
  response: new Response(null, { status }),
});

/** Answers one request as the API would. */
function serve(method: string, path: string, body: unknown) {
  if (method === 'PUT') return ok(); // upsert the hike
  if (path.endsWith('/sync-status')) {
    let seq = 0;
    while (server.points.has(seq)) seq++;
    return ok({ highestContinuousSeq: seq === 0 ? null : seq - 1 });
  }
  if (path.endsWith('/points')) {
    const { points } = body as { points: TrackPoint[] };
    for (const point of points) server.points.add(point.seq);
    return ok({ received: points.length, inserted: points.length });
  }
  if (path.endsWith('/finish')) {
    server.hikeFinished = true;
    return ok();
  }
  if (path === '/api/v1/uploads/presign') {
    links++;
    return ok({
      key: `uploads/me/${links}`,
      uploadUrl: `http://storage/${links}`,
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresInSeconds: 600,
    });
  }
  // POST /posts
  server.postRequests++;
  const post = body as {
    id: string;
    hikeId: string;
    caption: string | null;
    photos: { key: string }[];
  };
  if (!server.hikeFinished) return refuse(409, 'HIKE_NOT_FINISHED');
  const existing = server.posts.get(post.id);
  if (existing) return ok(existing); // same id again: the same post, not a new one
  if (post.photos.some((photo) => !server.stored.has(photo.key))) {
    return refuse(409, 'PHOTO_NOT_UPLOADED');
  }
  const created = {
    id: post.id,
    hikeId: post.hikeId,
    caption: post.caption,
    photoKeys: post.photos.map((p) => p.key),
  };
  server.posts.set(post.id, created);
  return ok(created);
}

/** Every API call goes through here, so the phone can be offline or lose a request. */
function connect(method: string) {
  return async (path: string, init: { body?: unknown }) => {
    if (!server.online) throw new TypeError('Network request failed');
    server.requests++;
    const cut = server.cuts.get(server.requests);
    if (cut === 'before') throw new TypeError('Network request failed');
    const reply = serve(method, path, init.body);
    if (cut === 'after') throw new TypeError('Network request failed');
    return reply;
  };
}

/**
 * On the trail with no signal: a hike is finished (queued for upload) and
 * shared with two photos and a caption (queued after it).
 */
async function sharedOffline(): Promise<{ db: Db; hikeId: string; postId: string }> {
  const db = createTestDb();
  await prepareDatabase(db);
  const hike = await createHike(db, clock);
  await addTrackPoints(
    db,
    hike.id,
    Array.from({ length: POINTS }, (_, i) => ({
      recordedAt: hike.startedAt + i * 5000,
      lat: 16.5966 + i * 0.00002,
      lng: 120.9089,
      altitudeM: 2000,
      accuracyM: 5,
      speedMps: 1.1,
    })),
  );
  await setHikeStatus(db, hike.id, 'finished', clock + POINTS * 5000);
  await enqueueUnsyncedHikes(db, clock);
  clock += 60_000; // the post is written a minute later
  const photo = (id: string) => ({
    id,
    fileUri: `file:///app/post-photos/${id}.jpg`,
    contentType: 'image/jpeg' as const,
    sizeBytes: 1234,
  });
  const postId = await createPost(
    db,
    {
      hikeId: hike.id,
      caption: 'Summit at dawn',
      visibility: 'public',
      photos: [photo('ph-1'), photo('ph-2')],
    },
    clock,
  );
  return { db, hikeId: hike.id, postId };
}

/** One sync run, as sync.ts does it. `wifi` says whether photos may upload now. */
const sync = (db: Db, wifi = true) =>
  processOutbox(
    db,
    { hike: uploadHike, post: (d, item) => uploadPost(d, item, async () => wifi) },
    () => clock,
  );

/** The signal is back: sync.ts makes everything due at once, then syncs. */
const reconnect = async (db: Db) => {
  server.online = true;
  await makeAllDue(db, clock);
};

/** What the feed would list: the server's posts, newest first, as ids. */
const feedIds = () => [...server.posts.keys()].reverse();

/** The goal of #41: on the server once, after its hike, and no longer queued on the phone. */
async function expectPostedOnce(db: Db, postId: string, hikeId: string) {
  expect(server.hikeFinished).toBe(true);
  expect(server.points.size).toBe(POINTS);
  expect([...server.posts.keys()]).toEqual([postId]);
  expect(server.posts.get(postId)).toMatchObject({ hikeId, caption: 'Summit at dawn' });
  expect(server.posts.get(postId)!.photoKeys).toHaveLength(2);
  expect((await getHike(db, hikeId))!.syncStatus).toBe('synced');
  expect((await getPost(db, postId))!.syncStatus).toBe('synced');
  expect(await listUnsentPosts(db)).toEqual([]);
  expect(await countPending(db)).toBe(0);
}

beforeEach(() => {
  jest.clearAllMocks();
  clock = Date.UTC(2026, 10, 9, 6, 0, 0);
  links = 0;
  server = {
    hikeFinished: false,
    points: new Set(),
    posts: new Map(),
    stored: new Set(),
    postRequests: 0,
    requests: 0,
    cuts: new Map(),
    online: false,
  };
  jest.mocked(api.PUT).mockImplementation(connect('PUT') as never);
  jest.mocked(api.GET).mockImplementation(connect('GET') as never);
  jest.mocked(api.POST).mockImplementation(connect('POST') as never);
  // A photo reaches storage only when the phone is online and the request isn't cut.
  jest.mocked(uploadPhotoFile).mockImplementation(async (_uri, url) => {
    if (!server.online) throw new TypeError('Network request failed');
    server.stored.add(`uploads/me/${url.split('/').at(-1)}`);
  });
});

describe('a post made offline (#41)', () => {
  it('waits on the phone, shown as queued, while there is no signal', async () => {
    const { db, postId } = await sharedOffline();

    // sync.ts doesn't even try offline; a run that tries anyway changes nothing.
    await sync(db);

    expect(server.posts.size).toBe(0);
    const unsent = await listUnsentPosts(db);
    expect(unsent.map((p) => p.id)).toEqual([postId]);
    expect(unsent[0]).toMatchObject({ caption: 'Summit at dawn', syncStatus: 'pending' });
    expect(unsent[0].photoUris).toHaveLength(2); // the phone's copies, shown on the card
  });

  it('goes up once, after its hike, in the first run back online', async () => {
    const { db, hikeId, postId } = await sharedOffline();
    await sync(db); // offline

    await reconnect(db);
    expect(await sync(db)).toMatchObject({ uploaded: 2, failed: 0 });

    await expectPostedOnce(db, postId, hikeId);
    expect(server.postRequests).toBe(1);
    expect(feedIds()).toEqual([postId]);
  });

  it('waits for its hike when the hike upload drops, without being refused', async () => {
    const { db, hikeId, postId } = await sharedOffline();
    await reconnect(db);
    // Request 3 is the hike's points: the signal goes again mid-hike.
    server.cuts.set(3, 'before');

    expect(await sync(db)).toMatchObject({ uploaded: 0 });
    expect(server.posts.size).toBe(0);
    expect(server.postRequests).toBe(0); // never sent before its hike was done
    expect((await getPost(db, postId))!.syncStatus).toBe('pending'); // still queued, not failed

    clock += 1000;
    await reconnect(db);
    await sync(db);

    await expectPostedOnce(db, postId, hikeId);
  });

  it('makes one post when the server got it but the reply was lost', async () => {
    const { db, hikeId, postId } = await sharedOffline();
    await reconnect(db);
    // Requests: 1 PUT hike, 2 sync-status, 3 points, 4 finish, 5 PUT hike,
    // 6-7 presign (the photo files aren't counted), 8 POST /posts.
    server.cuts.set(8, 'after');

    await sync(db);
    // On the server, but the phone doesn't know: it still shows it as queued…
    expect([...server.posts.keys()]).toEqual([postId]);
    expect((await listUnsentPosts(db)).map((p) => p.id)).toEqual([postId]);
    // …while the feed already has it: the queued copy must not show twice.
    const unsent = await listUnsentPosts(db);
    expect(unsentNotInFeed(unsent, feedIds())).toEqual([]);

    clock += 1000;
    await reconnect(db);
    await sync(db);

    await expectPostedOnce(db, postId, hikeId);
    expect(server.postRequests).toBe(2); // sent again with the same id…
    expect(links).toBe(2); // …without uploading the photos again
  });

  it('waits for Wi-Fi when photos may only upload on Wi-Fi, then goes', async () => {
    const { db, hikeId, postId } = await sharedOffline();
    await reconnect(db);

    // Back online on mobile data: the hike goes, the post waits without a failure.
    expect(await sync(db, false)).toMatchObject({ uploaded: 1, failed: 0, skipped: 1 });
    expect(server.hikeFinished).toBe(true);
    expect(server.posts.size).toBe(0);
    expect((await getPost(db, postId))!.syncStatus).toBe('pending');

    // On Wi-Fi it goes in the next run, with no retry wait to sit out.
    expect(await sync(db, true)).toMatchObject({ uploaded: 1 });
    await expectPostedOnce(db, postId, hikeId);
  });

  it('gets there on a patchy signal, still once', async () => {
    const { db, hikeId, postId } = await sharedOffline();
    for (let request = 2; request <= 30; request += 3) {
      server.cuts.set(request, request % 2 === 0 ? 'before' : 'after');
    }

    let tries = 0;
    while ((await getPost(db, postId))!.syncStatus !== 'synced' && tries < 20) {
      tries++;
      await reconnect(db);
      await sync(db);
      clock += 1000;
    }

    expect(tries).toBeGreaterThan(1);
    await expectPostedOnce(db, postId, hikeId);
  });
});
