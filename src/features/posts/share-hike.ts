import { getDb } from '@/db/database';
import type { HikeVisibility } from '@/db/hikes';
import { uuidv7 } from '@/db/ids';
import { createPost, type NewPost } from '@/db/posts';
import { deletePhotoFile, keepPhoto } from '@/sync/photo-files';
import { requestSync } from '@/sync/sync';

import type { PickedPhoto } from './pick-photos';

/** The API's limit on a caption. */
export const MAX_CAPTION_LENGTH = 2000;

/**
 * Posts a hike, as the Post button does: copies the photos into the app (the
 * picker's copies may be cleared), saves the post on the phone, and starts
 * uploading. Works offline: the outbox posts it once there's signal.
 */
export async function shareHike(share: {
  hikeId: string;
  caption: string;
  visibility: HikeVisibility;
  photos: readonly PickedPhoto[];
}): Promise<void> {
  const db = await getDb();
  const kept: NewPost['photos'] = [];
  try {
    for (const photo of share.photos) {
      const id = uuidv7();
      const { fileUri, sizeBytes } = await keepPhoto(photo.uri, id, photo.contentType);
      kept.push({ id, fileUri, contentType: photo.contentType, sizeBytes });
    }
    await createPost(db, {
      hikeId: share.hikeId,
      caption: share.caption.trim() || null,
      visibility: share.visibility,
      photos: kept,
    });
  } catch (error) {
    // Nothing was saved, so don't leave copies behind.
    for (const photo of kept) deletePhotoFile(photo.fileUri);
    throw error;
  }
  void requestSync();
}
