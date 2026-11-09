import { createHike, setHikeStatus, setSyncStatus } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { enqueue, getDueItems, markFailed } from '@/db/outbox';
import { createTestDb } from '@/db/__tests__/test-db';

import { loadSyncCounts } from '../sync-status-store';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

describe('loadSyncCounts', () => {
  it('reads waiting, backing-off and failed hikes from the database', async () => {
    const db = createTestDb();
    await prepareDatabase(db);
    expect(await loadSyncCounts(db, 1000)).toEqual({ waiting: 0, backingOff: 0, failed: 0 });

    await enqueue(db, 'hike', 'a', 1000);
    await enqueue(db, 'hike', 'b', 1000);
    const [first] = await getDueItems(db, 1000);
    await markFailed(db, first.id, 'offline', 61_000);
    const rejected = await createHike(db, 500);
    await setHikeStatus(db, rejected.id, 'finished', 900);
    await setSyncStatus(db, rejected.id, 'failed');

    expect(await loadSyncCounts(db, 2000)).toEqual({ waiting: 2, backingOff: 1, failed: 1 });
  });
});
