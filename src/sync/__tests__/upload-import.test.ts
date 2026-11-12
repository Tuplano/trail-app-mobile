import { ApiError } from '@/api/errors';
import { createImportedHike, getHike, type Hike } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import { createTestDb } from '@/db/__tests__/test-db';

import { GiveUpError } from '../retry';
import { type SendImport, uploadImportedHike } from '../upload-import';

// The real request needs the phone's file system and session; these tests pass a fake one.
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('@/features/auth/auth-store', () => ({ useAuthStore: { getState: () => ({}) } }));
jest.mock('@/features/auth/refresh-session', () => ({ refreshSession: jest.fn() }));
jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test' } }));

const FILE = 'file:///docs/gpx-imports/imported-1.gpx';

async function importedHike() {
  const db = createTestDb();
  await prepareDatabase(db);
  const hike = await createImportedHike(db, {
    id: 'imported-1',
    title: 'Mt. Pulag',
    startedAt: 1000,
    endedAt: 61_000,
    fileUri: FILE,
    stats: { distanceM: 0, elevationGainM: 0, movingTimeS: 0 },
    points: [
      { recordedAt: 1000, lat: 16.5, lng: 120.5, altitudeM: null },
      { recordedAt: 61_000, lat: 16.51, lng: 120.5, altitudeM: null },
    ],
  });
  return { db, hike };
}

describe('uploadImportedHike', () => {
  it('sends the file, marks the hike synced, then deletes the copy', async () => {
    const { db, hike } = await importedHike();
    const sent: Hike[] = [];
    const send: SendImport = async (h) => {
      // Still marked as uploading while the request is out.
      expect((await getHike(db, h.id))?.syncStatus).toBe('syncing');
      sent.push(h);
    };
    const deleteFile = jest.fn();

    await uploadImportedHike(db, hike, send, deleteFile);
    expect(sent).toEqual([expect.objectContaining({ id: 'imported-1', importFileUri: FILE, title: 'Mt. Pulag' })]);
    expect(await getHike(db, 'imported-1')).toMatchObject({ syncStatus: 'synced', importFileUri: null });
    expect(deleteFile).toHaveBeenCalledWith(FILE);
  });

  it('keeps the file and tries again later after a network error or a server error', async () => {
    const { db, hike } = await importedHike();
    const deleteFile = jest.fn();
    for (const error of [new TypeError('Network request failed'), new ApiError('Busy', 503, 'UNKNOWN'), new ApiError('Slow down', 429, 'TOO_MANY_REQUESTS')]) {
      await expect(uploadImportedHike(db, hike, () => Promise.reject(error), deleteFile)).rejects.toBe(error);
      expect(await getHike(db, 'imported-1')).toMatchObject({ syncStatus: 'pending', importFileUri: FILE });
    }
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it.each([
    ['a file the server can’t read', new ApiError('Bad GPX', 400, 'INVALID_GPX')],
    ['a hike the server already has at that time', new ApiError('Overlaps', 409, 'HIKE_OVERLAPS')],
    ['a file over the size limit', new ApiError('Too large', 413, 'PAYLOAD_TOO_LARGE')],
  ])('gives up on %s, keeping the hike on the phone', async (_, error) => {
    const { db, hike } = await importedHike();
    await expect(uploadImportedHike(db, hike, () => Promise.reject(error), jest.fn())).rejects.toBeInstanceOf(
      GiveUpError,
    );
    expect(await getHike(db, 'imported-1')).toMatchObject({ syncStatus: 'failed', importFileUri: FILE });
  });

  it('gives up when the file is gone, without sending anything', async () => {
    const { db, hike } = await importedHike();
    const send = jest.fn();
    await expect(uploadImportedHike(db, { ...hike, importFileUri: null }, send, jest.fn())).rejects.toBeInstanceOf(
      GiveUpError,
    );
    expect(send).not.toHaveBeenCalled();
    expect((await getHike(db, 'imported-1'))?.syncStatus).toBe('failed');
  });
});
