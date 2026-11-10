import { Directory, File, Paths } from 'expo-file-system';

import type { PhotoContentType } from '@/db/posts';

/** The API refuses photos bigger than this (10 MB). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<PhotoContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * The app's own folder for photos waiting to upload. The picker hands back
 * files in the cache, which the phone may clear at any time; a post saved
 * offline must still have its photos when the signal comes back.
 */
function photosFolder(): Directory {
  const folder = new Directory(Paths.document, 'post-photos');
  folder.create({ idempotent: true, intermediates: true });
  return folder;
}

/** Copies a picked photo into the app's folder, named after the photo's id. */
export async function keepPhoto(
  pickedUri: string,
  photoId: string,
  contentType: PhotoContentType,
): Promise<{ fileUri: string; sizeBytes: number }> {
  const copy = new File(photosFolder(), `${photoId}.${EXTENSIONS[contentType]}`);
  await new File(pickedUri).copy(copy);
  return { fileUri: copy.uri, sizeBytes: copy.size };
}

/**
 * PUTs a photo straight to storage, with exactly the headers the API gave
 * (storage checks the type and size). The file goes from disk natively, not
 * through JavaScript memory.
 */
export async function uploadPhotoFile(
  fileUri: string,
  uploadUrl: string,
  headers: Record<string, string>,
): Promise<void> {
  const result = await new File(fileUri).upload(uploadUrl, { httpMethod: 'PUT', headers });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Storage refused the photo (HTTP ${result.status})`);
  }
}

/** Deletes the app's copy once it's uploaded, or the post is gone. Never throws. */
export function deletePhotoFile(fileUri: string): void {
  try {
    const file = new File(fileUri);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('Could not delete a photo file', error);
  }
}
