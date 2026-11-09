import { createHike, getHike, setHikeStatus } from './hikes';
import { prepareDatabase } from './migrations';
import { createTestDb } from './test-db';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

describe('setHikeStatus', () => {
  it('saves pauses and resumes without an end time', async () => {
    const db = await freshDb();
    const { id } = await createHike(db, 1000);

    await setHikeStatus(db, id, 'paused', 2000);
    expect(await getHike(db, id)).toMatchObject({
      status: 'paused',
      endedAt: null,
      clientUpdatedAt: 2000,
    });

    await setHikeStatus(db, id, 'recording', 3000);
    expect(await getHike(db, id)).toMatchObject({ status: 'recording', endedAt: null });
  });

  it('records the end time when finishing', async () => {
    const db = await freshDb();
    const { id } = await createHike(db, 1000);
    await setHikeStatus(db, id, 'finished', 5000);
    expect(await getHike(db, id)).toMatchObject({
      status: 'finished',
      endedAt: 5000,
      clientUpdatedAt: 5000,
    });
  });

  it('fails for an unknown hike', async () => {
    const db = await freshDb();
    await expect(setHikeStatus(db, 'nope', 'paused')).rejects.toThrow(/not found/);
  });
});
