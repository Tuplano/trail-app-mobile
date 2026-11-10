import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import { createHike, getHike, setHikeStatus, setSyncStatus } from '@/db/hikes';
import { prepareDatabase } from '@/db/migrations';
import type { OutboxItem } from '@/db/outbox';
import { createPost, getPost } from '@/db/posts';
import { createTestDb } from '@/db/__tests__/test-db';

import { deletePhotoFile, uploadPhotoFile } from '../photo-files';
import { GiveUpError, NotYetError } from '../retry';
import { HikeNotUploadedError, uploadPost } from '../upload-post';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) =>
    new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));
// The API and the files are faked; the database is real.
jest.mock('@/api/client', () => ({ api: { PUT: jest.fn(), POST: jest.fn() } }));
jest.mock('../photo-files', () => ({ uploadPhotoFile: jest.fn(), deletePhotoFile: jest.fn() }));

const put = jest.mocked(api.PUT);
const post = jest.mocked(api.POST);
const uploadFile = jest.mocked(uploadPhotoFile);
const ok = (data: unknown = {}) => ({ data, error: undefined, response: new Response() }) as never;
const fail = (status: number, code: string) =>
  ({
    data: undefined,
    error: { error: { code, message: code } },
    response: new Response(null, { status }),
  }) as never;

/** The fake POST's calls, as [path, body] pairs. */
const posts = () =>
  (post.mock.calls as unknown as [string, { body: Record<string, unknown> }][]).map(
    ([path, init]) => [path, init.body] as const,
  );
const presigns = () => posts().filter(([path]) => path === '/api/v1/uploads/presign');
const postBodies = () => posts().filter(([path]) => path === '/api/v1/posts');

/** A finished hike shared with two photos. `hikeSync` is how far the hike's own upload got. */
async function sharedHike(hikeSync: 'pending' | 'synced' | 'failed' = 'synced') {
  const db = createTestDb();
  await prepareDatabase(db);
  const hike = await createHike(db, 1000);
  await setHikeStatus(db, hike.id, 'finished', 2000);
  await setSyncStatus(db, hike.id, hikeSync);
  const photo = (id: string) => ({
    id,
    fileUri: `file:///app/post-photos/${id}.jpg`,
    contentType: 'image/jpeg' as const,
    sizeBytes: 1234,
  });
  const postId = await createPost(db, {
    hikeId: hike.id,
    caption: 'Clear skies',
    visibility: 'public',
    photos: [photo('ph-1'), photo('ph-2')],
  });
  const item: OutboxItem = {
    id: 1,
    kind: 'post',
    entityId: postId,
    attempts: 0,
    lastError: null,
    nextAttemptAt: 0,
    createdAt: 0,
  };
  return { db, hikeId: hike.id, postId, item };
}

let links = 0;
beforeEach(() => {
  jest.clearAllMocks();
  links = 0;
  put.mockResolvedValue(ok());
  post.mockImplementation(async (path) => {
    if (path === '/api/v1/uploads/presign') {
      links++;
      return ok({
        key: `uploads/me/${links}`,
        uploadUrl: `http://storage/${links}`,
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        expiresInSeconds: 600,
      });
    }
    return ok({ id: 'created' });
  });
  uploadFile.mockResolvedValue();
});

describe('uploadPost', () => {
  it('sets who can see the hike, uploads the photos, then creates the post', async () => {
    const { db, hikeId, postId, item } = await sharedHike();

    await uploadPost(db, item);

    expect(put).toHaveBeenCalledWith('/api/v1/hikes/{id}', {
      params: { path: { id: hikeId } },
      body: expect.objectContaining({ visibility: 'public' }),
    });
    expect(presigns()).toEqual([
      ['/api/v1/uploads/presign', { contentType: 'image/jpeg', sizeBytes: 1234 }],
      ['/api/v1/uploads/presign', { contentType: 'image/jpeg', sizeBytes: 1234 }],
    ]);
    expect(uploadFile).toHaveBeenNthCalledWith(
      1,
      'file:///app/post-photos/ph-1.jpg',
      'http://storage/1',
      {
        'Content-Type': 'image/jpeg',
      },
    );
    expect(postBodies()).toEqual([
      [
        '/api/v1/posts',
        {
          id: postId,
          hikeId,
          caption: 'Clear skies',
          photos: [
            { id: 'ph-1', key: 'uploads/me/1' },
            { id: 'ph-2', key: 'uploads/me/2' },
          ],
        },
      ],
    ]);
    expect((await getPost(db, postId))!.syncStatus).toBe('synced');
    // The server has the photos now, so the phone's copies go.
    expect(deletePhotoFile).toHaveBeenCalledTimes(2);
  });

  it('waits, without failing, while photos may not upload on this connection', async () => {
    const { db, postId, item } = await sharedHike();
    const photosAllowed = jest.fn(async () => false);

    await expect(uploadPost(db, item, photosAllowed)).rejects.toBeInstanceOf(NotYetError);

    expect(put).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect((await getPost(db, postId))!.syncStatus).toBe('pending');
  });

  it("doesn't wait for Wi-Fi once every photo is uploaded", async () => {
    const { db, postId, item } = await sharedHike();
    const saved = (await getPost(db, postId))!;
    for (const [i, photo] of saved.photos.entries()) {
      await db.runAsync('UPDATE post_photos SET upload_key = ? WHERE id = ?', [
        `uploads/me/${i}`,
        photo.id,
      ]);
    }

    await uploadPost(db, item, async () => false);

    expect(presigns()).toEqual([]);
    expect(postBodies()).toHaveLength(1);
    expect((await getPost(db, postId))!.syncStatus).toBe('synced');
  });

  it('waits for the hike to upload first, sending nothing', async () => {
    const { db, postId, item } = await sharedHike('pending');

    await expect(uploadPost(db, item)).rejects.toBeInstanceOf(HikeNotUploadedError);

    expect(put).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect((await getPost(db, postId))!.syncStatus).toBe('pending');
  });

  it("gives up when the server didn't accept the hike", async () => {
    const { db, postId, item } = await sharedHike('failed');
    await expect(uploadPost(db, item)).rejects.toBeInstanceOf(GiveUpError);
    expect((await getPost(db, postId))!.syncStatus).toBe('failed');
  });

  it("doesn't upload a photo twice when a retry follows a lost connection", async () => {
    const { db, postId, item } = await sharedHike();
    uploadFile
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(uploadPost(db, item)).rejects.toThrow('Network request failed');
    expect((await getPost(db, postId))!.syncStatus).toBe('pending');
    expect(postBodies()).toEqual([]);

    jest.clearAllMocks();
    await uploadPost(db, item);

    // Only the second photo is uploaded again; the first keeps its key.
    expect(presigns()).toHaveLength(1);
    expect(postBodies()[0][1].photos).toEqual([
      { id: 'ph-1', key: 'uploads/me/1' },
      { id: 'ph-2', key: 'uploads/me/3' },
    ]);
  });

  it('uploads the photos again when storage no longer has them', async () => {
    const { db, postId, item } = await sharedHike();
    post.mockImplementation(async (path) =>
      path === '/api/v1/posts'
        ? fail(409, 'PHOTO_NOT_UPLOADED')
        : ok({ key: 'uploads/me/x', uploadUrl: 'http://storage/x', headers: {} }),
    );

    const error = await uploadPost(db, item).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(GiveUpError); // retried, not dropped
    const saved = (await getPost(db, postId))!;
    expect(saved.syncStatus).toBe('pending');
    expect(saved.photos.map((p) => p.uploadKey)).toEqual([null, null]);
  });

  it('gives up when the server refuses the post', async () => {
    const { db, postId, item } = await sharedHike();
    post.mockImplementation(async (path) =>
      path === '/api/v1/posts'
        ? fail(409, 'HIKE_ALREADY_POSTED')
        : ok({ key: 'uploads/me/x', uploadUrl: 'http://storage/x', headers: {} }),
    );

    await expect(uploadPost(db, item)).rejects.toBeInstanceOf(GiveUpError);
    expect((await getPost(db, postId))!.syncStatus).toBe('failed');
    expect(deletePhotoFile).not.toHaveBeenCalled(); // still on the phone
  });

  it('treats a post deleted on the phone as done', async () => {
    const { db, hikeId, item } = await sharedHike();
    await db.runAsync('DELETE FROM posts');
    await expect(uploadPost(db, item)).resolves.toBeUndefined();
    expect(put).not.toHaveBeenCalled();
    expect(await getHike(db, hikeId)).not.toBeNull();
  });
});
