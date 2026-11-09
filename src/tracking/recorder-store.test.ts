import { getHike } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { createTestDb } from '@/db/test-db';
import type { Db } from '@/db/types';

import { canTransition, useRecorderStore } from './recorder-store';

// The recorder saves to a real in-memory SQLite database (see db/test-db.ts).
let mockDb: Promise<Db>;
jest.mock('@/db/database', () => ({ getDb: () => mockDb }));
jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

const initialState = useRecorderStore.getState();
const recorder = () => useRecorderStore.getState();

beforeEach(() => {
  useRecorderStore.setState(initialState, true);
  mockDb = (async () => {
    const db = createTestDb();
    await prepareDatabase(db);
    return db;
  })();
});

const hikeCount = async () =>
  (await (await mockDb).getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM hikes'))?.n;

describe('recorder store', () => {
  it('saves every step of a hike to the database', async () => {
    const db = await mockDb;

    await recorder().start();
    const { hikeId } = recorder();
    expect(recorder()).toMatchObject({ status: 'recording', saving: false });
    expect(await getHike(db, hikeId!)).toMatchObject({ status: 'recording', endedAt: null });

    await recorder().pause();
    expect(recorder().status).toBe('paused');
    expect((await getHike(db, hikeId!))?.status).toBe('paused');

    await recorder().resume();
    expect((await getHike(db, hikeId!))?.status).toBe('recording');

    await recorder().finish();
    expect(recorder().status).toBe('finished');
    const finished = await getHike(db, hikeId!);
    expect(finished).toMatchObject({ status: 'finished', syncStatus: 'pending' });
    expect(finished?.endedAt).toEqual(expect.any(Number));

    recorder().reset();
    expect(recorder()).toMatchObject({ status: 'idle', hikeId: null });
    expect((await getHike(db, hikeId!))?.status).toBe('finished'); // the hike stays saved
  });

  it('rejects invalid transitions without touching the database', async () => {
    await expect(recorder().pause()).rejects.toThrow(/idle to paused/);
    await expect(recorder().finish()).rejects.toThrow(/idle to finished/);
    expect(() => recorder().reset()).toThrow(/idle to idle/);
    expect(await hikeCount()).toBe(0);
    expect(canTransition('finished', 'recording')).toBe(false);
  });

  it('creates one hike when Start is tapped twice quickly', async () => {
    const first = recorder().start();
    await expect(recorder().start()).rejects.toThrow(/still saving/);
    await first;
    expect(recorder().status).toBe('recording');
    expect(await hikeCount()).toBe(1);
  });

  it('stays where it was when saving fails', async () => {
    mockDb = Promise.reject(new Error('disk full'));
    await expect(recorder().start()).rejects.toThrow('disk full');
    expect(recorder()).toMatchObject({ status: 'idle', hikeId: null, saving: false });
  });
});
