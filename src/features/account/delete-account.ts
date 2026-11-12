import { Directory, Paths } from 'expo-file-system';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { queryClient } from '@/api/query-client';
import { wipeAccountData } from '@/db/account-data';
import { getDb } from '@/db/database';
import { useAuthStore } from '@/features/auth/auth-store';
import { useSettingsStore } from '@/features/settings/settings-store';

/**
 * Deletes the account on the server (DELETE /me, confirmed with the
 * password), then everything of it on this phone, and signs out. The server
 * goes first: if it refuses (wrong password, no signal), nothing on the
 * phone is touched. Throws ApiError or a network error on failure.
 */
export async function deleteAccount(password: string): Promise<void> {
  const { error, response } = await api.DELETE('/api/v1/me', { body: { password } });
  if (!response.ok) throw toApiError(error, response);
  await forgetAccountOnPhone();
}

/**
 * The phone side, once the server has deleted the account: the database
 * rows, the files waiting to upload (photos, imported GPX), the settings,
 * the cached server data and the session. Offline maps stay: they're map
 * tiles, nothing about the person. A step that fails is logged and the rest
 * still run, so the person always ends up signed out.
 */
async function forgetAccountOnPhone(): Promise<void> {
  try {
    await wipeAccountData(await getDb());
  } catch (error) {
    console.warn('Could not clear the hikes on this phone', error);
  }
  for (const name of ['post-photos', 'gpx-imports']) {
    try {
      const folder = new Directory(Paths.document, name);
      if (folder.exists) folder.delete();
    } catch (error) {
      console.warn(`Could not delete ${name}`, error);
    }
  }
  await useSettingsStore
    .getState()
    .load()
    .catch((error: unknown) => console.warn('Could not reload settings', error));

  // The server already ended every sign-in, so there's no logout call to make.
  await useAuthStore.getState().clear();
  queryClient.clear();
}
