import { api } from '@/api/client';
import { getHike, listFinishedHikes } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { createTestDb } from '@/db/__tests__/test-db';
import { addTrackPoints } from '@/db/track-points';
import type { Db } from '@/db/types';

import { claimHikes, ownerVerdict } from '../claim-hikes';

const ME = 'user-1';
const SOMEONE_ELSE = 'user-2';

// The API is faked: each call answers like openapi-fetch ({ data } or { error, response }).
jest.mock('@/api/client', () => ({ api: { GET: jest.fn() } }));

const get = jest.mocked(api.GET);
const answer = (status: number, data?: object) =>
  ({ data, error: data ? undefined : {}, response: new Response(null, { status }) }) as never;

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

/** A finished hike saved before the app recorded owners (user_id NULL). */
async function oldHike(db: Db, id: string, syncStatus: 'synced' | 'pending', startedAt: number) {
  await db.runAsync(
    `INSERT INTO hikes (id, status, started_at, ended_at, client_updated_at, sync_status)
     VALUES (?, 'finished', ?, ?, ?, ?)`,
    [id, startedAt, startedAt + 1000, startedAt, syncStatus],
  );
  await addTrackPoints(db, id, [{ recordedAt: startedAt, lat: 14.6, lng: 121.0 }]);
}

beforeEach(() => jest.clearAllMocks());

describe('ownerVerdict', () => {
  it("is yes only for the server's own owner", () => {
    expect(ownerVerdict({ status: 'found', ownerId: ME }, ME)).toBe('yes');
    expect(ownerVerdict({ status: 'found', ownerId: SOMEONE_ELSE }, ME)).toBe('no');
  });

  it("is no when the server doesn't show it to this account", () => {
    expect(ownerVerdict({ status: 'notFound' }, ME)).toBe('no');
  });

  it('is unknown when the server could not answer', () => {
    expect(ownerVerdict({ status: 'error' }, ME)).toBe('unknown');
  });
});

describe('claimHikes', () => {
  it('gives the account its own uploaded hikes, and only those', async () => {
    const db = await freshDb();
    await oldHike(db, 'mine', 'synced', 1000);
    await oldHike(db, 'theirs', 'synced', 2000);
    await oldHike(db, 'never-uploaded', 'pending', 3000);
    get.mockImplementation((async (_path: string, { params }: { params: { path: { id: string } } }) =>
      params.path.id === 'mine' ? answer(200, { userId: ME }) : answer(404)) as never);

    expect(await claimHikes(db, ME)).toBe(1);

    expect((await listFinishedHikes(db, ME)).map((h) => h.id)).toEqual(['mine']);
    // Another account's hike waits for that account to sign in and claim it.
    expect((await getHike(db, 'theirs'))?.userId).toBeNull();
    // Never reached the server: can't be checked, so nobody gets it (or uploads it).
    expect((await getHike(db, 'never-uploaded'))?.userId).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('lets the other account claim its hikes later', async () => {
    const db = await freshDb();
    await oldHike(db, 'theirs', 'synced', 2000);
    get.mockResolvedValue(answer(200, { userId: SOMEONE_ELSE }));

    expect(await claimHikes(db, ME)).toBe(0);
    expect(await claimHikes(db, SOMEONE_ELSE)).toBe(1);
    expect((await listFinishedHikes(db, SOMEONE_ELSE)).map((h) => h.id)).toEqual(['theirs']);
  });

  it('claims nothing and throws when the server is unreachable, to try again later', async () => {
    const db = await freshDb();
    await oldHike(db, 'mine', 'synced', 1000);
    get.mockResolvedValue(answer(500));

    await expect(claimHikes(db, ME)).rejects.toThrow();
    expect((await getHike(db, 'mine'))?.userId).toBeNull();
  });
});
