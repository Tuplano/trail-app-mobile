import { OWNED_BY } from './outbox';
import type { Db } from './types';

/**
 * What this phone holds of the account that hasn't reached the server: hikes
 * not uploaded yet (finished ones with points, and any still being recorded)
 * and posts not sent. Deleting the account deletes these from the phone too,
 * so the delete screen warns about them.
 */
export async function countNotUploaded(
  db: Db,
  userId: string,
): Promise<{ hikes: number; posts: number }> {
  const hikes = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM hikes h
     WHERE h.user_id = ? AND h.sync_status != 'synced'
       AND EXISTS (SELECT 1 FROM track_points p WHERE p.hike_id = h.id)`,
    [userId],
  );
  const posts = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM posts p JOIN hikes h ON h.id = p.hike_id
     WHERE h.user_id = ? AND p.sync_status != 'synced'`,
    [userId],
  );
  return { hikes: hikes?.n ?? 0, posts: posts?.n ?? 0 };
}

/**
 * Removes everything of one account from the phone's database: its hikes and
 * their points, posts and their photos' rows, and its upload queue items.
 * Other accounts' data on the phone, and the phone's settings, stay. One
 * transaction: all or nothing.
 *
 * Returns the app's own files that belonged to those rows (photos waiting to
 * upload, imported GPX copies), for the caller to delete: files aren't in
 * the database, so they can't be part of the transaction.
 */
export async function wipeAccountData(db: Db, userId: string): Promise<string[]> {
  let files: string[] = [];
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<{ uri: string }>(
      `SELECT ph.file_uri AS uri FROM post_photos ph
         JOIN posts p ON p.id = ph.post_id JOIN hikes h ON h.id = p.hike_id
       WHERE h.user_id = ?
       UNION
       SELECT import_file_uri AS uri FROM hikes
       WHERE user_id = ? AND import_file_uri IS NOT NULL`,
      [userId, userId],
    );
    files = rows.map((row) => row.uri);
    // The queue first: finding a post item's owner needs the post row.
    await db.runAsync(`DELETE FROM outbox WHERE ${OWNED_BY}`, [userId]);
    // Points, posts and photo rows go with their hike (ON DELETE CASCADE).
    await db.runAsync('DELETE FROM hikes WHERE user_id = ?', [userId]);
  });
  return files;
}
