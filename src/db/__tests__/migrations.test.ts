import { MIGRATIONS, migrate, prepareDatabase, SCHEMA_VERSION } from '../migrations';
import { createTestDb } from './test-db';
import type { Db } from '../types';

async function freshDb(): Promise<Db> {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

const version = async (db: Db) =>
  (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;

const insertHike = (db: Db, id = 'h1', status = 'recording') =>
  db.runAsync(
    'INSERT INTO hikes (id, status, started_at, client_updated_at) VALUES (?, ?, 1, 1)',
    [id, status],
  );

const insertPoint = (db: Db, hikeId: string, seq: number, lat = 46.5) =>
  db.runAsync(
    'INSERT INTO track_points (hike_id, seq, recorded_at, lat, lng) VALUES (?, ?, 1, ?, 7.9)',
    [hikeId, seq, lat],
  );

describe('migrate', () => {
  it('creates the tables and records the schema version', async () => {
    const db = await freshDb();
    expect(await version(db)).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(MIGRATIONS.length);

    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual([
      'hikes',
      'outbox',
      'post_photos',
      'posts',
      'track_points',
    ]);
  });

  it('upgrades a version 1 database, keeping its hikes private', async () => {
    const db = createTestDb();
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[0]);
      await db.execAsync('PRAGMA user_version = 1');
    });
    await insertHike(db, 'old', 'finished');

    await migrate(db);

    expect(await version(db)).toBe(SCHEMA_VERSION);
    expect(await db.getFirstAsync('SELECT visibility FROM hikes WHERE id = ?', ['old'])).toEqual({
      visibility: 'private',
    });
  });

  it('does nothing when already up to date', async () => {
    const db = await freshDb();
    await insertHike(db);
    await migrate(db);
    expect(await version(db)).toBe(SCHEMA_VERSION);
    expect(await db.getAllAsync('SELECT id FROM hikes')).toHaveLength(1);
  });

  it('refuses a database made by a newer version of the app', async () => {
    const db = createTestDb();
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    await expect(migrate(db)).rejects.toThrow(/newer than this app/);
  });
});

describe('schema rules', () => {
  it('rejects points for a hike that does not exist', async () => {
    const db = await freshDb();
    await expect(insertPoint(db, 'missing', 0)).rejects.toThrow(/FOREIGN KEY/);
  });

  it('deletes a hike’s points with the hike', async () => {
    const db = await freshDb();
    await insertHike(db);
    await insertPoint(db, 'h1', 0);
    await insertPoint(db, 'h1', 1);
    await db.runAsync('DELETE FROM hikes WHERE id = ?', ['h1']);
    expect(await db.getAllAsync('SELECT seq FROM track_points')).toHaveLength(0);
  });

  it('allows each seq once per hike', async () => {
    const db = await freshDb();
    await insertHike(db);
    await insertPoint(db, 'h1', 0);
    await expect(insertPoint(db, 'h1', 0)).rejects.toThrow(/UNIQUE|PRIMARY KEY/);
  });

  it('rejects unknown statuses and impossible coordinates', async () => {
    const db = await freshDb();
    await expect(insertHike(db, 'h2', 'walking')).rejects.toThrow(/CHECK/);
    await insertHike(db);
    await expect(insertPoint(db, 'h1', 0, 91)).rejects.toThrow(/CHECK/);
  });

  it('queues each thing in the outbox once', async () => {
    const db = await freshDb();
    const enqueue = () =>
      db.runAsync(
        "INSERT INTO outbox (kind, entity_id, next_attempt_at, created_at) VALUES ('hike', 'h1', 0, 0)",
      );
    await enqueue();
    await expect(enqueue()).rejects.toThrow(/UNIQUE/);
  });
});
