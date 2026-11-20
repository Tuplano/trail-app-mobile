import { createHike, setHikeStatus, setSyncStatus } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { enqueue, getDueItems, markFailed } from '@/db/outbox';
import { createTestDb } from '@/db/__tests__/test-db';

import { loadSyncCounts } from '../sync-status-store';

/** The signed-in account in these tests: hikes and posts belong to an account. */
const USER = 'user-1';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

describe('loadSyncCounts', () => {
  it('reads waiting, backing-off and failed hikes from the database', async () => {
    const db = createTestDb();
    await prepareDatabase(db);
    expect(await loadSyncCounts(db, USER, 1000)).toEqual({ waiting: 0, backingOff: 0, failed: 0 });

    // Queued hikes of this account (only the signed-in account's count).
    for (const id of ['a', 'b']) {
      await db.runAsync(
        'INSERT INTO hikes (id, user_id, started_at, client_updated_at) VALUES (?, ?, 0, 0)',
        [id, USER],
      );
      await enqueue(db, 'hike', id, 1000);
    }
    const [first] = await getDueItems(db, USER, 1000);
    await markFailed(db, first.id, 'offline', 61_000);
    const rejected = await createHike(db, USER, 500);
    await setHikeStatus(db, rejected.id, 'finished', 900);
    await setSyncStatus(db, rejected.id, 'failed');

    expect(await loadSyncCounts(db, USER, 2000)).toEqual({ waiting: 2, backingOff: 1, failed: 1 });
  });
});
