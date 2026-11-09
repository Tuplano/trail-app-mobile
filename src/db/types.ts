import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * The parts of expo-sqlite's database that our code uses. Functions take this
 * instead of opening the database themselves, so tests can pass an in-memory
 * SQLite database (see __tests__/test-db.ts) and run the real SQL.
 *
 * withExclusiveTransactionAsync is left out on purpose: expo-sqlite runs it on a
 * second connection, where `PRAGMA foreign_keys = ON` from prepareDatabase()
 * doesn't apply.
 */
export type Db = Pick<
  SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'withTransactionAsync'
>;
