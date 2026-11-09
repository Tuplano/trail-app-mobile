import { getDb } from '@/db/database';
import { enqueueUnsyncedHikes } from '@/db/outbox';

/**
 * Puts finished, not-yet-uploaded hikes in the outbox. Safe to call any time:
 * already-queued hikes are skipped. Never throws; a miss is caught by the
 * next call (after the next Finish, or when the app opens).
 */
export async function queueFinishedHikes(): Promise<void> {
  try {
    await enqueueUnsyncedHikes(await getDb());
  } catch (error) {
    console.warn('Could not queue hikes for upload', error);
  }
}
