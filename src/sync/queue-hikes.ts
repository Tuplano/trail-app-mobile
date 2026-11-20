import { getDb } from '@/db/database';
import { enqueueUnsyncedHikes } from '@/db/outbox';
import { signedInUserId } from '@/features/auth/auth-store';

/**
 * Puts the signed-in account's finished, not-yet-uploaded hikes in the
 * outbox. Safe to call any time: already-queued hikes are skipped. Never
 * throws; a miss is caught by the next call (after the next Finish, or when
 * the app opens).
 */
export async function queueFinishedHikes(): Promise<void> {
  const userId = signedInUserId();
  if (!userId) return;
  try {
    await enqueueUnsyncedHikes(await getDb(), userId);
  } catch (error) {
    console.warn('Could not queue hikes for upload', error);
  }
}
