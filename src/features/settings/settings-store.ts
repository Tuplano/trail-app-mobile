import { create } from 'zustand';

import { getDb } from '@/db/database';
import { DEFAULT_SETTINGS, getSettings, setSetting, type Settings } from '@/db/settings';
import { requestSync } from '@/sync/sync';

type SettingsState = {
  /** The saved settings; the defaults until load() has read them. */
  settings: Settings;
  load: () => Promise<void>;
  /** Saves a change and shows it straight away. */
  change: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
};

/**
 * The hiker's settings, for the screens. SQLite is the real record (the
 * upload code reads it from there); this keeps a copy so screens update the
 * moment something changes.
 */
export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,

  load: async () => {
    set({ settings: await getSettings(await getDb()) });
  },

  change: async (key, value) => {
    const before = get().settings;
    set({ settings: { ...before, [key]: value } });
    try {
      await setSetting(await getDb(), key, value);
    } catch (error) {
      set({ settings: before }); // not saved: show what is
      throw error;
    }
    // Allowing mobile data lets photos waiting for Wi-Fi go now.
    if (key === 'photosOnWifiOnly' && value === false) void requestSync();
  },
}));
