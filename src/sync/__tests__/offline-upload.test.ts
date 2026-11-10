import { api } from '@/api/client';
import { createHike, getHike, setHikeStatus } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { countPending, enqueueUnsyncedHikes, getNextAttemptAt, makeAllDue } from '@/db/outbox';
import { createTestDb } from '@/db/__tests__/test-db';
import { addTrackPoints, countTrackPoints, getTrackPoints, type TrackPoint } from '@/db/track-points';
import type { Db } from '@/db/types';

import { processOutbox } from '../process-outbox';
import { FIRST_RETRY_MS } from '../retry';
import { uploadHike } from '../upload-hike';

/*
 * Task #35: the signal drops in the middle of an upload (airplane mode, a
 * tunnel, a dead zone on the trail). Afterwards the server must hold every
 * point of the hike exactly once: none missing, none twice.
 *
 * The phone side is real (SQLite, outbox, uploadHike). The server is a small
 * fake that follows the real API's rules (trail-app-api, hikes.service.ts):
 * a point is stored once per seq (a repeat is ignored), sync-status reports
 * the unbroken run from seq 0, and finish refuses while any seq is missing.
 */

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));
jest.mock('@/api/client', () => ({ api: { PUT: jest.fn(), GET: jest.fn(), POST: jest.fn() } }));

/** 2,400 points: five requests of up to 500, like a long day hike. */
const TOTAL = 2400;

/**
 * How the connection fails on one request: 'before' it reaches the server
 * (nothing stored), or 'after' (stored, but the reply never comes back, so
 * the phone can't know it worked).
 */
type Cut = 'before' | 'after';

type FakeServer = {
  hikeExists: boolean;
  finishedWith: number | null;
  /** Stored points by seq. */
  points: Map<number, TrackPoint>;
  /** Every seq the phone sent, repeats included. */
  sent: number[];
  /** Requests so far, and which ones the connection drops. */
  requests: number;
  cuts: Map<number, Cut>;
};

let server: FakeServer;

const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
const pointsMissing = (missingRanges: { from: number; to: number }[]) => ({
  data: undefined,
  error: { error: { code: 'POINTS_MISSING', message: 'Points are missing', missingRanges } },
  response: new Response(null, { status: 409 }),
});

/** The unbroken run of stored seqs from 0 ends here (null: no seq 0). */
function highestContinuousSeq(): number | null {
  let seq = 0;
  while (server.points.has(seq)) seq++;
  return seq === 0 ? null : seq - 1;
}

function missingRanges(total: number): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  for (let seq = 0; seq < total; seq++) {
    if (server.points.has(seq)) continue;
    const last = ranges.at(-1);
    if (last && last.to === seq - 1) last.to = seq;
    else ranges.push({ from: seq, to: seq });
  }
  return ranges;
}

/** Answers one request as the API would. */
function serve(method: string, path: string, body: unknown) {
  if (method === 'PUT') {
    server.hikeExists = true;
    return ok({});
  }
  if (path.endsWith('/sync-status')) return ok({ highestContinuousSeq: highestContinuousSeq() });
  if (path.endsWith('/points')) {
    const { points } = body as { points: TrackPoint[] };
    let inserted = 0;
    for (const point of points) {
      server.sent.push(point.seq);
      if (server.finishedWith != null || server.points.has(point.seq)) continue; // ON CONFLICT DO NOTHING
      server.points.set(point.seq, point);
      inserted++;
    }
    return ok({ received: points.length, inserted });
  }
  // POST /finish
  const { totalPoints } = body as { totalPoints: number };
  if (server.finishedWith === totalPoints) return ok({}); // a repeated finish
  const missing = missingRanges(totalPoints);
  if (missing.length > 0) return pointsMissing(missing);
  server.finishedWith = totalPoints;
  return ok({});
}

/** Every API call goes through here, so a request can lose its connection. */
function connect(method: string) {
  return async (path: string, init: { body?: unknown }) => {
    server.requests++;
    const cut = server.cuts.get(server.requests);
    if (cut === 'before') throw new TypeError('Network request failed');
    const reply = serve(method, path, init.body);
    if (cut === 'after') throw new TypeError('Network request failed');
    return reply;
  };
}

/** A finished hike on the phone, queued for upload. */
async function phoneWithHike(): Promise<{ db: Db; hikeId: string }> {
  const db = createTestDb();
  await prepareDatabase(db);
  const hike = await createHike(db, Date.UTC(2026, 10, 9, 6, 0, 0));
  const points = Array.from({ length: TOTAL }, (_, i) => ({
    recordedAt: hike.startedAt + i * 5000,
    lat: 16.5966 + i * 0.00002,
    lng: 120.9089,
    altitudeM: 2000 + (i % 50),
    accuracyM: 5,
    speedMps: 1.1,
  }));
  await addTrackPoints(db, hike.id, points);
  await setHikeStatus(db, hike.id, 'finished', hike.startedAt + TOTAL * 5000);
  await enqueueUnsyncedHikes(db, clock);
  return { db, hikeId: hike.id };
}

let clock: number;
const sync = (db: Db) => processOutbox(db, { hike: uploadHike }, () => clock);
/** The signal is back: sync.ts makes everything due at once, then syncs. */
const reconnect = (db: Db) => makeAllDue(db, clock);

/** The goal of #35: the server holds exactly the phone's points, each once, and the hike is done. */
async function expectServerMatchesPhone(db: Db, hikeId: string) {
  const phonePoints = await getTrackPoints(db, hikeId, 0, TOTAL + 1);
  expect(phonePoints).toHaveLength(TOTAL); // the phone kept everything
  expect(server.points.size).toBe(TOTAL); // no gaps, nothing extra
  for (const point of phonePoints) expect(server.points.get(point.seq)).toEqual(point);
  expect(server.finishedWith).toBe(TOTAL);
  expect((await getHike(db, hikeId))!.syncStatus).toBe('synced');
  expect(await countPending(db)).toBe(0);
}

/** The phone never sent the same point twice (beyond what the server ignores anyway). */
const resent = () => server.sent.filter((seq, i) => server.sent.indexOf(seq) !== i);

beforeEach(() => {
  clock = 1_000_000;
  server = {
    hikeExists: false,
    finishedWith: null,
    points: new Map(),
    sent: [],
    requests: 0,
    cuts: new Map(),
  };
  jest.mocked(api.PUT).mockImplementation(connect('PUT') as never);
  jest.mocked(api.GET).mockImplementation(connect('GET') as never);
  jest.mocked(api.POST).mockImplementation(connect('POST') as never);
});

// Requests in one upload: 1 PUT hike, 2 GET sync-status, 3-7 the five chunks
// of points (seq 0-499, 500-999, …, 2000-2399), 8 POST finish.

describe('signal lost in the middle of an upload (#35)', () => {
  it('picks up where it stopped when the signal drops between chunks', async () => {
    const { db, hikeId } = await phoneWithHike();
    server.cuts.set(5, 'before'); // the third chunk never arrives

    expect(await sync(db)).toMatchObject({ uploaded: 0, failed: 1 });
    // Half-uploaded: the server has the first two chunks, the phone still has it all.
    expect(server.points.size).toBe(1000);
    expect(server.finishedWith).toBeNull();
    expect((await getHike(db, hikeId))!.syncStatus).toBe('pending');
    expect(await countTrackPoints(db, hikeId)).toBe(TOTAL);
    // Left alone it would wait a minute before trying again…
    expect(await getNextAttemptAt(db)).toBe(clock + FIRST_RETRY_MS);

    // …but the signal coming back cuts that short.
    await reconnect(db);
    expect(await sync(db)).toMatchObject({ uploaded: 1, failed: 0 });

    await expectServerMatchesPhone(db, hikeId);
    expect(resent()).toEqual([]); // the second try started at seq 1000
  });

  it("doesn't send a chunk twice when the server got it but the reply was lost", async () => {
    const { db, hikeId } = await phoneWithHike();
    server.cuts.set(5, 'after'); // seq 1000-1499 stored, phone never hears back

    await sync(db);
    expect(server.points.size).toBe(1500);

    await reconnect(db);
    await sync(db);

    await expectServerMatchesPhone(db, hikeId);
    // sync-status told the phone the server already had up to 1499.
    expect(resent()).toEqual([]);
  });

  it('finishes cleanly when the finish reached the server but its reply was lost', async () => {
    const { db, hikeId } = await phoneWithHike();
    server.cuts.set(8, 'after');

    await sync(db);
    expect(server.finishedWith).toBe(TOTAL); // done on the server…
    expect((await getHike(db, hikeId))!.syncStatus).toBe('pending'); // …but the phone doesn't know

    await reconnect(db);
    await sync(db);

    await expectServerMatchesPhone(db, hikeId);
    expect(resent()).toEqual([]);
  });

  it('starts over safely when the signal is gone before anything arrives', async () => {
    const { db, hikeId } = await phoneWithHike();
    server.cuts.set(1, 'before');

    await sync(db);
    expect(server.hikeExists).toBe(false);

    await reconnect(db);
    await sync(db);
    await expectServerMatchesPhone(db, hikeId);
  });

  it('gets there in the end on a patchy signal that keeps coming and going', async () => {
    const { db, hikeId } = await phoneWithHike();
    // Every fourth of the first 40 requests is lost, alternating before and
    // after it reaches the server.
    for (let request = 4; request <= 40; request += 4) {
      server.cuts.set(request, request % 8 === 0 ? 'before' : 'after');
    }

    let tries = 0;
    while ((await getHike(db, hikeId))!.syncStatus !== 'synced' && tries < 20) {
      tries++;
      await sync(db);
      clock += 1000;
      await reconnect(db);
    }

    expect(tries).toBeGreaterThan(1);
    await expectServerMatchesPhone(db, hikeId);
    expect(resent()).toEqual([]);
  });
});
