import type { Db } from './types';

/**
 * What this phone holds that hasn't reached the server: hikes not uploaded
 * yet (finished ones with points, and any still being recorded) and posts not
 * sent. Deleting the account deletes these from the phone too, so the delete
 * screen warns about them.
 */
export async function countNotUploaded(db: Db): Promise<{ hikes: number; posts: number }> {
  const hikes = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM hikes h
     WHERE h.sync_status != 'synced'
       AND EXISTS (SELECT 1 FROM track_points p WHERE p.hike_id = h.id)`,
  );
  const posts = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM posts WHERE sync_status != 'synced'",
  );
  return { hikes: hikes?.n ?? 0, posts: posts?.n ?? 0 };
}

/**
 * Removes everything of the account from the phone's database: hikes and
 * their points, posts and their photos' rows, the upload queue and the
 * settings. Without this, the upload queue would send the old account's
 * hikes to whoever signs in next. One transaction: all or nothing.
 * (Photo and GPX files are deleted separately; offline maps are kept.)
 */
export async function wipeAccountData(db: Db): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM outbox;
      DELETE FROM post_photos;
      DELETE FROM posts;
      DELETE FROM track_points;
      DELETE FROM hikes;
      DELETE FROM settings;
    `);
  });
}
