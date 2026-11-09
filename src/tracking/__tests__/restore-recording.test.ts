import { createHike, getHike, getUnfinishedHikes, setHikeStatus } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { createTestDb } from '@/db/__tests__/test-db';
import { addTrackPoints } from '@/db/track-points';

import { findHikeToRestore } from '../restore-recording';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

/** A point ~11 m further north per step, 10 s apart. */
const point = (step: number, start = 1_000_000) => ({
  recordedAt: start + step * 10_000,
  lat: 14.6 + step * 0.0001,
  lng: 121.0,
  altitudeM: 100,
  accuracyM: 5,
});

describe('findHikeToRestore', () => {
  it('is null when every hike is finished', async () => {
    const db = await freshDb();
    expect(await findHikeToRestore(db)).toBeNull();

    const { id } = await createHike(db);
    await setHikeStatus(db, id, 'finished');
    expect(await findHikeToRestore(db)).toBeNull();
  });

  it('returns the unfinished hike with its path and stats', async () => {
    const db = await freshDb();
    const { id, startedAt } = await createHike(db, 1_000_000);
    await addTrackPoints(db, id, [point(0), point(1), point(2)]);
    await setHikeStatus(db, id, 'paused');

    const hike = await findHikeToRestore(db);
    expect(hike).toMatchObject({ id, status: 'paused', startedAt });
    expect(hike!.path).toHaveLength(3);
    expect(hike!.stats.pointCount).toBe(3);
    expect(hike!.stats.distanceM).toBeCloseTo(22.2, 0);
  });

  it('finishes older unfinished hikes left by crashes, ending at their last point', async () => {
    const db = await freshDb();
    const oldWithPoints = await createHike(db, 1_000_000);
    await addTrackPoints(db, oldWithPoints.id, [point(0), point(1)]);
    const oldEmpty = await createHike(db, 2_000_000);
    const newest = await createHike(db, 3_000_000);

    expect((await findHikeToRestore(db))?.id).toBe(newest.id);

    expect(await getHike(db, oldWithPoints.id)).toMatchObject({
      status: 'finished',
      endedAt: point(1).recordedAt,
    });
    expect(await getHike(db, oldEmpty.id)).toMatchObject({ status: 'finished', endedAt: 2_000_000 });
    expect((await getUnfinishedHikes(db)).map((h) => h.id)).toEqual([newest.id]);
  });
});
