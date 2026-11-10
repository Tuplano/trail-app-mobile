import type { HikeVisibility, SyncStatus } from './hikes';
import { uuidv7 } from './ids';
import { enqueue } from './outbox';
import type { Db } from './types';

/** Image types the API takes for photos. */
export type PhotoContentType = 'image/jpeg' | 'image/png' | 'image/webp';

/** A photo on a post, as stored on the phone. */
export type PostPhoto = {
  id: string;
  position: number;
  /** The app's own copy of the file (see features/posts/photo-files.ts). */
  fileUri: string;
  contentType: PhotoContentType;
  sizeBytes: number;
  /** Where storage keeps it, once uploaded; null until then. */
  uploadKey: string | null;
};

/** A hike shared as a post, as stored on the phone. */
export type Post = {
  id: string;
  hikeId: string;
  caption: string | null;
  createdAt: number;
  syncStatus: SyncStatus;
  photos: PostPhoto[];
};

type PostRow = {
  id: string;
  hike_id: string;
  caption: string | null;
  created_at: number;
  sync_status: SyncStatus;
};

type PostPhotoRow = {
  id: string;
  position: number;
  file_uri: string;
  content_type: PhotoContentType;
  size_bytes: number;
  upload_key: string | null;
};

/** What the hiker chose on the New post screen. */
export type NewPost = {
  hikeId: string;
  caption: string | null;
  visibility: HikeVisibility;
  /** In the order to show them. Ids are made first, so the files can be named after them. */
  photos: Pick<PostPhoto, 'id' | 'fileUri' | 'contentType' | 'sizeBytes'>[];
};

/**
 * Saves a post and queues it for upload, all at once: it works offline, and
 * a crash can't leave a post that never uploads. Who can see it is set on
 * the hike (as in the API), which counts as an edit, so client_updated_at
 * moves and the server takes the new visibility. Returns the post's id.
 */
export async function createPost(db: Db, post: NewPost, now: number = Date.now()): Promise<string> {
  const id = uuidv7(now);
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO posts (id, hike_id, caption, created_at) VALUES (?, ?, ?, ?)', [
      id,
      post.hikeId,
      post.caption,
      now,
    ]);
    for (const [position, photo] of post.photos.entries()) {
      await db.runAsync(
        `INSERT INTO post_photos (id, post_id, position, file_uri, content_type, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [photo.id, id, position, photo.fileUri, photo.contentType, photo.sizeBytes],
      );
    }
    const hike = await db.runAsync(
      'UPDATE hikes SET visibility = ?, client_updated_at = ? WHERE id = ?',
      [post.visibility, now, post.hikeId],
    );
    if (hike.changes === 0) throw new Error(`Hike ${post.hikeId} not found`);
    await enqueue(db, 'post', id, now);
  });
  return id;
}

/** A post with its photos in order, or null if there's no such post. */
export async function getPost(db: Db, id: string): Promise<Post | null> {
  const row = await db.getFirstAsync<PostRow>('SELECT * FROM posts WHERE id = ?', [id]);
  if (!row) return null;
  const photos = await db.getAllAsync<PostPhotoRow>(
    'SELECT * FROM post_photos WHERE post_id = ? ORDER BY position',
    [id],
  );
  return {
    id: row.id,
    hikeId: row.hike_id,
    caption: row.caption,
    createdAt: row.created_at,
    syncStatus: row.sync_status,
    photos: photos.map((p) => ({
      id: p.id,
      position: p.position,
      fileUri: p.file_uri,
      contentType: p.content_type,
      sizeBytes: p.size_bytes,
      uploadKey: p.upload_key,
    })),
  };
}

/** The hike's post, if it was shared (a hike has at most one). */
export async function getPostForHike(
  db: Db,
  hikeId: string,
): Promise<{ id: string; syncStatus: SyncStatus } | null> {
  const row = await db.getFirstAsync<Pick<PostRow, 'id' | 'sync_status'>>(
    'SELECT id, sync_status FROM posts WHERE hike_id = ?',
    [hikeId],
  );
  return row ? { id: row.id, syncStatus: row.sync_status } : null;
}

/** How the post's upload is going, like setSyncStatus for hikes. */
export async function setPostSyncStatus(db: Db, id: string, status: SyncStatus): Promise<void> {
  await db.runAsync('UPDATE posts SET sync_status = ? WHERE id = ?', [status, id]);
}

/**
 * Remembers where storage put a photo, so a retry doesn't upload it again.
 * Null forgets it, for a photo storage no longer has.
 */
export async function setPhotoUploadKey(
  db: Db,
  photoId: string,
  key: string | null,
): Promise<void> {
  await db.runAsync('UPDATE post_photos SET upload_key = ? WHERE id = ?', [key, photoId]);
}

/** Forgets every upload of a post's photos, so they are all uploaded again. */
export async function clearPhotoUploadKeys(db: Db, postId: string): Promise<void> {
  await db.runAsync('UPDATE post_photos SET upload_key = NULL WHERE post_id = ?', [postId]);
}
