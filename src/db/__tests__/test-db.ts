// Node's types only here, not app-wide: app code runs in React Native, not Node.
/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Db } from '../types';

/**
 * For tests only: an in-memory SQLite database (Node's built-in one) behind the
 * same methods as expo-sqlite, so tests run the app's real SQL. Never import
 * this from app code; Metro can't bundle node:sqlite.
 */
export function createTestDb(): Db {
  const raw = new DatabaseSync(':memory:');
  // expo-sqlite takes params as one array or as separate arguments.
  const bind = (args: unknown[]) =>
    (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) as SQLInputValue[];

  const db = {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, ...args: unknown[]) {
      const result = raw.prepare(sql).run(...bind(args));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getFirstAsync(sql: string, ...args: unknown[]) {
      const row = raw.prepare(sql).get(...bind(args));
      return row ? { ...row } : null;
    },
    async getAllAsync(sql: string, ...args: unknown[]) {
      return raw
        .prepare(sql)
        .all(...bind(args))
        .map((row) => ({ ...row }));
    },
    async withTransactionAsync(task: () => Promise<void>) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return db as unknown as Db;
}
