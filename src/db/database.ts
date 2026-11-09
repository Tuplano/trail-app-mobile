import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { prepareDatabase } from './migrations';

const DATABASE_NAME = 'trail.db';

let opening: Promise<SQLiteDatabase> | null = null;

/**
 * The app's one database connection, opened and migrated on first use.
 * A plain function rather than a React provider, because the background
 * location task (no React there) writes GPS points into it too.
 */
export function getDb(): Promise<SQLiteDatabase> {
  opening ??= openAndPrepare().catch((error: unknown) => {
    opening = null; // let the next call try again
    throw error;
  });
  return opening;
}

async function openAndPrepare(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await prepareDatabase(db);
  return db;
}
