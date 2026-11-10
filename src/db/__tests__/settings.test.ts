import { prepareDatabase } from '../migrations';
import { DEFAULT_SETTINGS, getSettings, setSetting } from '../settings';
import { createTestDb } from './test-db';

async function freshDb() {
  const db = createTestDb();
  await prepareDatabase(db);
  return db;
}

describe('settings', () => {
  it('starts with the defaults: photos wait for Wi-Fi', async () => {
    const db = await freshDb();
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.photosOnWifiOnly).toBe(true);
  });

  it('keeps a changed setting, and can change it back', async () => {
    const db = await freshDb();

    await setSetting(db, 'photosOnWifiOnly', false);
    expect((await getSettings(db)).photosOnWifiOnly).toBe(false);

    await setSetting(db, 'photosOnWifiOnly', true);
    expect((await getSettings(db)).photosOnWifiOnly).toBe(true);
    expect(await db.getAllAsync('SELECT * FROM settings')).toHaveLength(1);
  });
});
