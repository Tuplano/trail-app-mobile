import type { Db } from './types';

/**
 * Each setting with its type and its value until the hiker changes it.
 * Kept in SQLite (not only in memory) so the upload code, which can run
 * without any screen, reads the same value the Settings screen shows.
 */
export type Settings = {
  /** Wait for Wi-Fi before uploading photos. Hikes upload on any connection. */
  photosOnWifiOnly: boolean;
};

/** As in the design: photos wait for Wi-Fi unless the hiker turns it off. */
export const DEFAULT_SETTINGS: Settings = {
  photosOnWifiOnly: true,
};

/** Every setting, with the default for any the hiker never changed. */
export async function getSettings(db: Db): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings');
  const saved = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    photosOnWifiOnly:
      saved.photosOnWifiOnly === undefined
        ? DEFAULT_SETTINGS.photosOnWifiOnly
        : saved.photosOnWifiOnly === 'true',
  };
}

/** Saves one setting. */
export async function setSetting<K extends keyof Settings>(
  db: Db,
  key: K,
  value: Settings[K],
): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [key, String(value)],
  );
}
