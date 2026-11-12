import { File } from 'expo-file-system';

import { ApiError, toApiError } from '@/api/errors';
import { env } from '@/config/env';
import { clearImportFile, type Hike, setSyncStatus } from '@/db/hikes';
import type { Db } from '@/db/types';
import { useAuthStore } from '@/features/auth/auth-store';
import { refreshSession } from '@/features/auth/refresh-session';

import { GiveUpError, isPermanent } from './retry';

/** Sends an imported hike's GPX file to the API; throws ApiError (or a network error) on failure. */
export type SendImport = (hike: Hike & { importFileUri: string }) => Promise<void>;

/**
 * Uploads a hike imported from a GPX file: PUT /hikes/{id}/import with the
 * file. The server reads it, stores the points and processes the hike like
 * one recorded here. The id was made on the phone, so sending it again (after
 * a lost answer) returns the same hike rather than a second one.
 *
 * Throws like uploadHike: GiveUpError when retrying can never help (the hike
 * is marked 'failed'), anything else to retry later. Once the server has it,
 * the app's copy of the file is deleted.
 */
export async function uploadImportedHike(
  db: Db,
  hike: Hike,
  send: SendImport = sendImportFile,
  deleteFile: (uri: string) => void = deleteImportFile,
): Promise<void> {
  const fileUri = hike.importFileUri;
  if (!fileUri) {
    // Nothing left to send (the app's copy is gone): it can never upload.
    await setSyncStatus(db, hike.id, 'failed');
    throw new GiveUpError(new Error(`Imported hike ${hike.id} has no file`));
  }

  await setSyncStatus(db, hike.id, 'syncing');
  try {
    await send({ ...hike, importFileUri: fileUri });
  } catch (error) {
    // 413: the file is over the server's limit, which no retry changes.
    if (isPermanent(error) || (error instanceof ApiError && error.status === 413)) {
      await setSyncStatus(db, hike.id, 'failed'); // won't be queued again
      throw new GiveUpError(error);
    }
    await setSyncStatus(db, hike.id, 'pending'); // the outbox retries it later
    throw error;
  }

  await setSyncStatus(db, hike.id, 'synced');
  await clearImportFile(db, hike.id);
  deleteFile(fileUri);
}

/**
 * The request itself. It's multipart (a file), which the typed API client
 * doesn't send, so it goes through fetch directly, signed like the client
 * signs requests, with one session refresh on a 401.
 */
const sendImportFile: SendImport = async (hike) => {
  const file = new File(hike.importFileUri);
  if (!file.exists) {
    throw new ApiError('The imported file is no longer on this phone.', 400, 'IMPORT_FILE_MISSING');
  }

  const attempt = () => {
    const form = new FormData();
    // expo-file-system's File is a Blob, so it goes in the form as the file itself.
    form.append('file', file as unknown as Blob);
    if (hike.title) form.append('title', hike.title);
    form.append('visibility', hike.visibility);
    const token = useAuthStore.getState().session?.accessToken;
    return fetch(`${env.apiUrl}/api/v1/hikes/${hike.id}/import`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  };

  let response = await attempt();
  if (response.status === 401 && (await refreshSession()) === 'refreshed') {
    response = await attempt();
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw toApiError(body, response);
  }
};

/** Deletes the app's copy of an imported file. Never throws. */
export function deleteImportFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('Could not delete an imported GPX file', error);
  }
}
