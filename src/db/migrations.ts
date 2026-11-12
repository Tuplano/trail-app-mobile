import type { Db } from './types';

/**
 * Every schema change, in order. Never edit a migration that has shipped:
 * phones that already ran it won't run it again. Add a new one instead.
 *
 * Times are epoch milliseconds (INTEGER), the same unit the API uses for
 * points. Sync converts hike times to ISO strings when uploading.
 */
export const MIGRATIONS: readonly string[] = [
  // 1: hikes, their GPS points, and the upload queue.
  `
  CREATE TABLE hikes (
    id                TEXT PRIMARY KEY NOT NULL,  -- UUIDv7 made on the phone
    title             TEXT,
    status            TEXT NOT NULL DEFAULT 'recording'
                      CHECK (status IN ('recording', 'paused', 'finished')),
    started_at        INTEGER NOT NULL,
    ended_at          INTEGER,
    sync_status       TEXT NOT NULL DEFAULT 'pending'
                      CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed')),
    client_updated_at INTEGER NOT NULL,           -- last edit on the phone, sent with uploads
    -- Live stats, kept up to date while recording. The server's stats replace
    -- them in the history once it has processed the hike.
    distance_m        REAL NOT NULL DEFAULT 0,
    elevation_gain_m  REAL NOT NULL DEFAULT 0,
    moving_time_s     REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX hikes_by_start ON hikes (started_at DESC);

  CREATE TABLE track_points (
    hike_id     TEXT NOT NULL REFERENCES hikes (id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL CHECK (seq >= 0),  -- 0, 1, 2… with no gaps, like the API
    recorded_at INTEGER NOT NULL,                   -- GPS time
    lat         REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng         REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
    altitude_m  REAL,
    accuracy_m  REAL,
    speed_mps   REAL,
    PRIMARY KEY (hike_id, seq)
  ) WITHOUT ROWID;

  CREATE TABLE outbox (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    kind            TEXT NOT NULL,     -- what to upload, e.g. 'hike'
    entity_id       TEXT NOT NULL,     -- which one, e.g. the hike id
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    next_attempt_at INTEGER NOT NULL,  -- don't retry before this time
    created_at      INTEGER NOT NULL,
    UNIQUE (kind, entity_id)           -- queue each thing once
  );
  CREATE INDEX outbox_by_due ON outbox (next_attempt_at);
  `,

  // 2: sharing a hike as a post (Stage 5). Who can see a hike is set on the
  // hike, as in the API; until it is shared it stays private.
  `
  ALTER TABLE hikes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'followers', 'public'));

  CREATE TABLE posts (
    id          TEXT PRIMARY KEY NOT NULL,        -- UUIDv7 made on the phone
    hike_id     TEXT NOT NULL UNIQUE              -- one post per hike, like the API
                REFERENCES hikes (id) ON DELETE CASCADE,
    caption     TEXT,
    created_at  INTEGER NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending'
                CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed'))
  );

  CREATE TABLE post_photos (
    id           TEXT PRIMARY KEY NOT NULL,       -- UUIDv7 made on the phone
    post_id      TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    position     INTEGER NOT NULL,                -- 0, 1, 2… order to show them in
    file_uri     TEXT NOT NULL,                   -- the app's own copy, until uploaded
    content_type TEXT NOT NULL,                   -- image/jpeg, image/png or image/webp
    size_bytes   INTEGER NOT NULL,
    upload_key   TEXT,                            -- storage key, once uploaded
    UNIQUE (post_id, position)
  );
  `,

  // 3: the hiker's settings, one row per setting. Values are text; see
  // settings.ts for each setting's type and default (a missing row means
  // the default).
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  ) WITHOUT ROWID;
  `,

  // 4: hikes imported from a GPX file (#47). Where a hike came from, as in
  // the API ('manual' hikes aren't made on the phone), and the app's copy of
  // the imported file, kept until the server has it.
  `
  ALTER TABLE hikes ADD COLUMN source TEXT NOT NULL DEFAULT 'recorded'
    CHECK (source IN ('recorded', 'imported'));
  ALTER TABLE hikes ADD COLUMN import_file_uri TEXT;
  `,
];

/** The schema version this build of the app expects. */
export const SCHEMA_VERSION = MIGRATIONS.length;

/**
 * Brings the database up to SCHEMA_VERSION. SQLite's user_version records how
 * many migrations have run. Each one runs in its own transaction together
 * with the version bump, so a crash mid-migration leaves the old schema intact.
 * Nothing else uses the connection yet (getDb() waits for this), so a plain
 * transaction on the same connection is safe.
 */
export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current > SCHEMA_VERSION) {
    throw new Error(
      `Database is at version ${current}, newer than this app (${SCHEMA_VERSION}). Update the app.`,
    );
  }

  for (let version = current + 1; version <= SCHEMA_VERSION; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version - 1]);
      await db.execAsync(`PRAGMA user_version = ${version}`);
    });
  }
}

/** Per-connection settings, then migrations. Run once after opening. */
export async function prepareDatabase(db: Db): Promise<void> {
  // WAL lets the recorder write points while screens read. Foreign keys are
  // off by default in SQLite and must be turned on for every connection.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
}
