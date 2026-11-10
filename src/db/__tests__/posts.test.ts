import { createHike, deleteHike, getHike } from '../hikes';
import { prepareDatabase } from '../migrations';
import { getDueItems } from '../outbox';
import {
  clearPhotoUploadKeys,
  createPost,
  getPost,
  getPostForHike,
  setPhotoUploadKey,
  setPostSyncStatus,
} from '../posts';
import { createTestDb } from './test-db';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) =>
    new Uint8Array(jest.requireActual('node:crypto').randomBytes(count)),
}));

async function dbWithHike() {
  const db = createTestDb();
  await prepareDatabase(db);
  const hike = await createHike(db, 1000);
  return { db, hikeId: hike.id };
}

const photo = (id: string, sizeBytes = 2000) => ({
  id,
  fileUri: `file:///app/post-photos/${id}.jpg`,
  contentType: 'image/jpeg' as const,
  sizeBytes,
});

describe('createPost', () => {
  it('saves the post with its photos in order and queues it', async () => {
    const { db, hikeId } = await dbWithHike();

    const id = await createPost(
      db,
      { hikeId, caption: 'Foggy top', visibility: 'public', photos: [photo('p1'), photo('p2')] },
      5000,
    );

    expect(await getPost(db, id)).toEqual({
      id,
      hikeId,
      caption: 'Foggy top',
      createdAt: 5000,
      syncStatus: 'pending',
      photos: [
        { ...photo('p1'), position: 0, uploadKey: null },
        { ...photo('p2'), position: 1, uploadKey: null },
      ],
    });
    expect(await getDueItems(db, 5000)).toEqual([
      expect.objectContaining({ kind: 'post', entityId: id }),
    ]);
  });

  it('sets who can see the hike, as an edit the server will take', async () => {
    const { db, hikeId } = await dbWithHike();
    expect((await getHike(db, hikeId))!.visibility).toBe('private');

    await createPost(db, { hikeId, caption: null, visibility: 'followers', photos: [] }, 9000);

    expect(await getHike(db, hikeId)).toMatchObject({
      visibility: 'followers',
      clientUpdatedAt: 9000,
    });
  });

  it('allows one post per hike, saving nothing the second time', async () => {
    const { db, hikeId } = await dbWithHike();
    await createPost(db, { hikeId, caption: 'First', visibility: 'public', photos: [] });

    await expect(
      createPost(db, { hikeId, caption: 'Second', visibility: 'private', photos: [photo('p9')] }),
    ).rejects.toThrow(/UNIQUE/);

    expect((await getHike(db, hikeId))!.visibility).toBe('public');
    expect(await db.getAllAsync('SELECT id FROM post_photos')).toEqual([]);
    expect(await getDueItems(db, Date.now() + 1)).toHaveLength(1);
  });

  it("fails for a hike that isn't on the phone", async () => {
    const { db } = await dbWithHike();
    await expect(
      createPost(db, { hikeId: 'missing', caption: null, visibility: 'public', photos: [] }),
    ).rejects.toThrow();
    expect(await db.getAllAsync('SELECT id FROM posts')).toEqual([]);
  });
});

describe('a post after it is saved', () => {
  it('is found from its hike, with how its upload is going', async () => {
    const { db, hikeId } = await dbWithHike();
    expect(await getPostForHike(db, hikeId)).toBeNull();

    const id = await createPost(db, { hikeId, caption: null, visibility: 'public', photos: [] });
    await setPostSyncStatus(db, id, 'synced');

    expect(await getPostForHike(db, hikeId)).toEqual({ id, syncStatus: 'synced' });
  });

  it('remembers and forgets where its photos were uploaded', async () => {
    const { db, hikeId } = await dbWithHike();
    const id = await createPost(db, {
      hikeId,
      caption: null,
      visibility: 'public',
      photos: [photo('p1'), photo('p2')],
    });

    await setPhotoUploadKey(db, 'p1', 'uploads/u1/a');
    expect((await getPost(db, id))!.photos.map((p) => p.uploadKey)).toEqual(['uploads/u1/a', null]);

    await clearPhotoUploadKeys(db, id);
    expect((await getPost(db, id))!.photos.map((p) => p.uploadKey)).toEqual([null, null]);
  });

  it('goes with its hike when the hike is deleted', async () => {
    const { db, hikeId } = await dbWithHike();
    const id = await createPost(db, {
      hikeId,
      caption: null,
      visibility: 'public',
      photos: [photo('p1')],
    });

    await deleteHike(db, hikeId);

    expect(await getPost(db, id)).toBeNull();
    expect(await db.getAllAsync('SELECT id FROM post_photos')).toEqual([]);
  });
});
