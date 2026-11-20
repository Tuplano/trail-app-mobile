import { api } from '@/api/client';
import { createHike, getHike, setHikeStatus, setSyncStatus } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { createTestDb } from '@/db/__tests__/test-db';
import type { Db } from '@/db/types';

import { fetchServerStats, serverStatsOf } from '../server-stats';

/** The signed-in account in these tests: hikes and posts belong to an account. */
const USER = 'user-1';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));
// The API is faked: each call answers like openapi-fetch ({ data } or { error, response }).
jest.mock('@/api/client', () => ({ api: { GET: jest.fn() } }));

const get = jest.mocked(api.GET);
const answer = (status: number, data?: object) =>
  ({ data, error: data ? undefined : {}, response: new Response(null, { status }) }) as never;

const PROCESSED = { status: 'processed', distanceM: 5120, movingTimeS: 5400, elevationGainM: 312 };

/** A finished, uploaded hike showing the phone's estimate. */
async function uploadedHike(db: Db, startedAt = 1000) {
  const { id } = await createHike(db, USER, startedAt);
  await setHikeStatus(db, id, 'finished', startedAt + 1000);
  await setSyncStatus(db, id, 'synced');
  return id;
}

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

beforeEach(() => jest.clearAllMocks());

describe('serverStatsOf', () => {
  it("takes the server's numbers once it has processed the hike", () => {
    expect(serverStatsOf(PROCESSED as never)).toEqual({
      distanceM: 5120,
      movingTimeS: 5400,
      elevationGainM: 312,
    });
  });

  it('has none while the hike is waiting to be processed', () => {
    expect(serverStatsOf({ ...PROCESSED, status: 'finished' } as never)).toBeNull();
  });

  it('counts no climb for a hike without heights', () => {
    expect(serverStatsOf({ ...PROCESSED, elevationGainM: null } as never)?.elevationGainM).toBe(0);
  });
});

describe('fetchServerStats', () => {
  it("saves the server's numbers for processed hikes", async () => {
    const db = await freshDb();
    const id = await uploadedHike(db);
    get.mockResolvedValue(answer(200, PROCESSED));

    expect(await fetchServerStats(db, USER)).toEqual({ updated: 1, notReady: 0 });
    expect(get).toHaveBeenCalledWith('/api/v1/hikes/{id}', { params: { path: { id } } });
    expect(await getHike(db, id)).toMatchObject({ distanceM: 5120, statsSource: 'server' });

    // Done: it isn't asked about again.
    await fetchServerStats(db, USER);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("keeps the phone's estimate while the server is still working", async () => {
    const db = await freshDb();
    const id = await uploadedHike(db);
    get.mockResolvedValue(answer(200, { ...PROCESSED, status: 'finished' }));

    expect(await fetchServerStats(db, USER)).toEqual({ updated: 0, notReady: 1 });
    expect((await getHike(db, id))!.statsSource).toBe('phone');
  });

  it('skips a hike the server no longer has', async () => {
    const db = await freshDb();
    await uploadedHike(db, 1000);
    const newer = await uploadedHike(db, 2000);
    get.mockImplementation((async (_path: string, init: { params: { path: { id: string } } }) =>
      init.params.path.id === newer ? answer(404) : answer(200, PROCESSED)) as never);

    expect(await fetchServerStats(db, USER)).toEqual({ updated: 1, notReady: 0 });
  });

  it('stops at a server error, to try again on the next sync', async () => {
    const db = await freshDb();
    const id = await uploadedHike(db);
    get.mockResolvedValue(answer(503));

    await expect(fetchServerStats(db, USER)).rejects.toThrow();
    expect((await getHike(db, id))!.statsSource).toBe('phone');
  });
});
