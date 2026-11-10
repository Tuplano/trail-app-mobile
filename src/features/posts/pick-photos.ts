import * as ImagePicker from 'expo-image-picker';

import type { PhotoContentType } from '@/db/posts';
import { MAX_PHOTO_BYTES } from '@/sync/photo-files';

/** Photos per post, as in the design (the API takes up to 10). */
export const MAX_PHOTOS = 4;

/** A photo picked for a post, before Post copies it into the app. */
export type PickedPhoto = { uri: string; contentType: PhotoContentType; sizeBytes: number };

const TYPES_BY_EXTENSION: Record<string, PhotoContentType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Whether the API can take a picked photo: a JPEG, PNG or WebP of at most
 * 10 MB. The type comes from the picker, or else from the file's extension.
 */
export function checkPickedPhoto(asset: {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
}): { ok: true; photo: PickedPhoto } | { ok: false; reason: 'type' | 'size' } {
  const extension = asset.uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const type = asset.mimeType ?? TYPES_BY_EXTENSION[extension];
  const contentType = Object.values(TYPES_BY_EXTENSION).find((t) => t === type);
  if (!contentType) return { ok: false, reason: 'type' };
  // The exact size is read again from the app's copy before uploading.
  const sizeBytes = asset.fileSize ?? 0;
  if (sizeBytes > MAX_PHOTO_BYTES) return { ok: false, reason: 'size' };
  return { ok: true, photo: { uri: asset.uri, contentType, sizeBytes } };
}

/** What to tell the hiker about photos that couldn't be added, or null if all were. */
export function describeSkipped(skipped: { type: number; size: number }): string | null {
  if (skipped.size > 0 && skipped.type > 0) return "Some photos couldn't be added.";
  if (skipped.size > 0) {
    return skipped.size === 1 ? 'That photo is over 10 MB.' : 'Those photos are over 10 MB.';
  }
  if (skipped.type > 0) return 'Only JPEG, PNG and WebP photos can be added.';
  return null;
}

/**
 * Opens the phone's photo library to pick up to `room` photos. Re-saves them
 * as JPEG at 80% quality: plenty for a post, and far below the 10 MB limit.
 * Android's photo picker needs no permission.
 */
export async function pickPhotos(
  room: number,
): Promise<{ photos: PickedPhoto[]; message: string | null }> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: room,
    quality: 0.8,
  });
  if (result.canceled) return { photos: [], message: null };

  const photos: PickedPhoto[] = [];
  const skipped = { type: 0, size: 0 };
  // Some pickers ignore the limit, so cut to what fits.
  for (const asset of result.assets.slice(0, room)) {
    const checked = checkPickedPhoto(asset);
    if (checked.ok) photos.push(checked.photo);
    else skipped[checked.reason]++;
  }
  return { photos, message: describeSkipped(skipped) };
}
