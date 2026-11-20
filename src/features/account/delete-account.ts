import { File } from 'expo-file-system';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { queryClient } from '@/api/query-client';
import { wipeAccountData } from '@/db/account-data';
import { getDb } from '@/db/database';
import { signedInUserId, useAuthStore } from '@/features/auth/auth-store';

/**
 * Deletes the account on the server (DELETE /me, confirmed with the
 * password), then everything of it on this phone, and signs out. The server
 * goes first: if it refuses (wrong password, no signal), nothing on the
 * phone is touched. Throws ApiError or a network error on failure.
 */
export async function deleteAccount(password: string): Promise<void> {
  const userId = signedInUserId();
  const { error, response } = await api.DELETE('/api/v1/me', { body: { password } });
  if (!response.ok) throw toApiError(error, response);
  await forgetAccountOnPhone(userId);
}

/**
 * The phone side, once the server has deleted the account: its database rows
 * (hikes, points, posts, upload queue), its files waiting to upload (photos,
 * imported GPX), the cached server data and the session. Other accounts' data
 * on this phone stays, and so do the phone's settings and offline maps
 * (nothing about the person). A step that fails is logged and the rest still
 * run, so the person always ends up signed out.
 */
async function forgetAccountOnPhone(userId: string | null): Promise<void> {
  let files: string[] = [];
  try {
    if (userId) files = await wipeAccountData(await getDb(), userId);
  } catch (error) {
    console.warn('Could not clear the hikes on this phone', error);
  }
  for (const uri of files) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch (error) {
      console.warn(`Could not delete ${uri}`, error);
    }
  }

  // The server already ended every sign-in, so there's no logout call to make.
  await useAuthStore.getState().clear();
  queryClient.clear();
}
