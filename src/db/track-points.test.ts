import { createHike, getHike } from './hikes';
import { prepareDatabase } from './migrations';
import { createTestDb } from './test-db';
import { addTrackPoints, getTrackPoints, type NewTrackPoint } from './track-points';
import type { Db } from './types';

// expo-crypto is native; Node's crypto gives the same random bytes in tests.
jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

async function freshDb(): Promise<Db> {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

const fix = (i: number): NewTrackPoint => ({
  recordedAt: 1_700_000_000_000 + i * 1000,
  lat: 46.5 + i * 0.0001,
  lng: 7.9,
  altitudeM: 1200 + i,
  accuracyM: 5,
  speedMps: 1.2,
});

describe('createHike', () => {
  it('saves a recording hike with a UUIDv7 id and empty stats', async () => {
    const db = await freshDb();
    const hike = await createHike(db, 1_700_000_000_000);

    expect(hike).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{14}7/),
      title: null,
      status: 'recording',
      startedAt: 1_700_000_000_000,
      endedAt: null,
      syncStatus: 'pending',
      clientUpdatedAt: 1_700_000_000_000,
      distanceM: 0,
      elevationGainM: 0,
      movingTimeS: 0,
    });
    expect(await getHike(db, hike.id)).toEqual(hike);
  });

  it('returns null for an unknown id', async () => {
    const db = await freshDb();
    expect(await getHike(db, 'nope')).toBeNull();
  });
});

describe('addTrackPoints', () => {
  it('numbers points from 0 and continues where the last batch ended', async () => {
    const db = await freshDb();
    const { id } = await createHike(db);

    await addTrackPoints(db, id, [fix(0), fix(1)]);
    await addTrackPoints(db, id, [fix(2)]);

    const points = await getTrackPoints(db, id);
    expect(points.map((p) => p.seq)).toEqual([0, 1, 2]);
    expect(points.map((p) => p.recordedAt)).toEqual([fix(0), fix(1), fix(2)].map((p) => p.recordedAt));
  });

  it('returns points in the API upload shape, with missing readings as null', async () => {
    const db = await freshDb();
    const { id } = await createHike(db);
    await addTrackPoints(db, id, [{ recordedAt: 5, lat: 1, lng: 2 }]);

    expect(await getTrackPoints(db, id)).toEqual([
      { seq: 0, recordedAt: 5, lat: 1, lng: 2, altitudeM: null, accuracyM: null, speedMps: null },
    ]);
  });

  it('keeps each hike’s numbering separate', async () => {
    const db = await freshDb();
    const a = await createHike(db, 1);
    const b = await createHike(db, 2);
    await addTrackPoints(db, a.id, [fix(0), fix(1)]);
    await addTrackPoints(db, b.id, [fix(0)]);

    expect((await getTrackPoints(db, b.id)).map((p) => p.seq)).toEqual([0]);
  });

  it('saves nothing from a batch with a bad point', async () => {
    const db = await freshDb();
    const { id } = await createHike(db);
    await expect(addTrackPoints(db, id, [fix(0), { ...fix(1), lat: 200 }])).rejects.toThrow(
      /CHECK/,
    );
    expect(await getTrackPoints(db, id)).toEqual([]);
  });

  it('handles more points than fit in one INSERT', async () => {
    const db = await freshDb();
    const { id } = await createHike(db);
    await addTrackPoints(db, id, Array.from({ length: 1201 }, (_, i) => fix(i)));

    const page = await getTrackPoints(db, id, 1000, 500);
    expect(page.map((p) => p.seq)).toEqual(Array.from({ length: 201 }, (_, i) => 1000 + i));
  });
});
