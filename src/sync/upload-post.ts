import { api } from '@/api/client';
import { ApiError, toApiError } from '@/api/errors';
import { getHike } from '@/db/hikes';
import type { OutboxItem } from '@/db/outbox';
import { clearPhotoUploadKeys, getPost, setPhotoUploadKey, setPostSyncStatus } from '@/db/posts';
import type { Db } from '@/db/types';

import { deletePhotoFile, uploadPhotoFile } from './photo-files';
import { GiveUpError, isPermanent, NotYetError } from './retry';
import { toUpsertBody } from './upload-hike';

/** The post can't go up before its hike: the API needs the finished hike first. */
export class HikeNotUploadedError extends Error {
  constructor() {
    super('Waiting for the hike to upload first');
    this.name = 'HikeNotUploadedError';
  }
}

/**
 * Uploads one shared hike:
 *
 * 1. Waits for the hike itself to be uploaded (the outbox retries later),
 *    and, if photos still need uploading, for a connection they may use
 *    (`photosAllowed`: Wi-Fi, unless the hiker allows mobile data).
 * 2. PUT /hikes/{id}: sends the hike again, so the server has who can see it.
 * 3. Each photo not uploaded yet: POST /uploads/presign for a link, PUT the
 *    file there, and remember its key so a retry skips it.
 * 4. POST /posts with the caption and the photos' keys.
 *
 * Every step is safe to repeat: the post's id is made on the phone, so
 * sending it twice returns the same post. Throws on failure: GiveUpError when
 * retrying can't help (the post is marked 'failed'), anything else to retry.
 */
export async function uploadPost(
  db: Db,
  item: OutboxItem,
  photosAllowed: () => Promise<boolean> = async () => true,
): Promise<void> {
  const post = await getPost(db, item.entityId);
  if (!post) return; // deleted on the phone: nothing to upload
  const hike = await getHike(db, post.hikeId);
  if (!hike) return; // deleting a hike deletes its post too

  if (hike.syncStatus === 'failed') {
    await setPostSyncStatus(db, post.id, 'failed');
    throw new GiveUpError(
      new Error("The server didn't accept the hike, so it can't take its post"),
    );
  }
  // Usually the hike is uploaded first anyway: it was queued first.
  if (hike.syncStatus !== 'synced') throw new HikeNotUploadedError();
  // The post can't be created before its photos are uploaded, so it waits too.
  if (post.photos.some((photo) => !photo.uploadKey) && !(await photosAllowed())) {
    throw new NotYetError('Waiting for Wi-Fi to upload the photos');
  }

  await setPostSyncStatus(db, post.id, 'syncing');
  try {
    const params = { path: { id: hike.id } };
    const saved = await api.PUT('/api/v1/hikes/{id}', { params, body: toUpsertBody(hike) });
    if (!saved.data) throw toApiError(saved.error, saved.response);

    const photos: { id: string; key: string }[] = [];
    for (const photo of post.photos) {
      let key = photo.uploadKey;
      if (!key) {
        const link = await api.POST('/api/v1/uploads/presign', {
          body: { contentType: photo.contentType, sizeBytes: photo.sizeBytes },
        });
        if (!link.data) throw toApiError(link.error, link.response);
        await uploadPhotoFile(photo.fileUri, link.data.uploadUrl, link.data.headers);
        key = link.data.key;
        await setPhotoUploadKey(db, photo.id, key);
      }
      photos.push({ id: photo.id, key });
    }

    const created = await api.POST('/api/v1/posts', {
      body: { id: post.id, hikeId: hike.id, caption: post.caption, photos },
    });
    if (!created.data) throw toApiError(created.error, created.response);

    await setPostSyncStatus(db, post.id, 'synced');
    // The server keeps the photos now; free the phone's copies.
    for (const photo of post.photos) deletePhotoFile(photo.fileUri);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'PHOTO_NOT_UPLOADED') {
      // Storage no longer has an upload (unused ones are removed after a
      // week): forget the keys so the next try uploads the photos again.
      await clearPhotoUploadKeys(db, post.id);
      await setPostSyncStatus(db, post.id, 'pending');
      throw error;
    }
    if (isPermanent(error)) {
      await setPostSyncStatus(db, post.id, 'failed'); // won't be queued again
      throw new GiveUpError(error);
    }
    await setPostSyncStatus(db, post.id, 'pending'); // the outbox retries it later
    throw error;
  }
}
