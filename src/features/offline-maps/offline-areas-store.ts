import {
  OfflineManager,
  type OfflinePack,
  type OfflinePackStatus,
} from '@maplibre/maplibre-react-native';
import { create } from 'zustand';

import { MAP_STYLE_URLS } from '@/config/map';

import { type Bounds, MAX_BYTES, MAX_ZOOM, MIN_ZOOM, tileVersion } from './offline-area';

/** A map area saved on the phone, as the Offline maps screen lists it. */
export type OfflineArea = {
  id: string;
  name: string;
  bounds: Bounds;
  /** When it was downloaded (epoch ms). */
  downloadedAt: number;
  /** The map data version it holds (see tileVersion); null if unknown. */
  version: string | null;
  percent: number;
  sizeBytes: number;
  complete: boolean;
  downloading: boolean;
};

/** What the app stores with each MapLibre pack. */
type AreaMetadata = { name?: unknown; downloadedAt?: unknown; version?: unknown };

/** OpenFreeMap's tile index, which names the current map data version. */
const TILE_INDEX_URL = 'https://tiles.openfreemap.org/planet';

/** The map data version OpenFreeMap serves now; null offline. */
export async function currentMapVersion(): Promise<string | null> {
  try {
    const index = (await (await fetch(TILE_INDEX_URL)).json()) as { tiles?: string[] };
    return index.tiles?.[0] ? tileVersion(index.tiles[0]) : null;
  } catch {
    return null;
  }
}

function toArea(pack: OfflinePack, status: OfflinePackStatus | null): OfflineArea {
  const meta = pack.metadata as AreaMetadata;
  return {
    id: pack.id,
    name: typeof meta.name === 'string' ? meta.name : 'Map area',
    bounds: pack.bounds,
    downloadedAt: typeof meta.downloadedAt === 'number' ? meta.downloadedAt : 0,
    version: typeof meta.version === 'string' ? meta.version : null,
    percent: status?.percentage ?? 0,
    sizeBytes: status?.completedResourceSize ?? 0,
    complete: status?.state === 'complete',
    downloading: status?.state === 'active',
  };
}

type OfflineAreasState = {
  areas: OfflineArea[];
  loaded: boolean;
  /** The last download problem, shown on the Offline maps screen. */
  error: string | null;
  /** The map data version OpenFreeMap serves now, to spot outdated areas. */
  currentVersion: string | null;
  load: () => Promise<void>;
  download: (name: string, bounds: Bounds) => Promise<void>;
  resume: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Downloads an outdated area again from the current map data. */
  update: (id: string) => Promise<void>;
  clearError: () => void;
};

/**
 * The downloaded map areas (MapLibre "offline packs"). MapLibre keeps the
 * areas and their tiles in its own database; this keeps a list for the
 * screens, with each download's progress.
 */
export const useOfflineAreasStore = create<OfflineAreasState>()((set, get) => {
  /** Areas deleted while still downloading: late progress events are ignored. */
  const removed = new Set<string>();

  const show = (area: OfflineArea) =>
    set((state) => ({
      areas: state.areas.some((a) => a.id === area.id)
        ? state.areas.map((a) => (a.id === area.id ? area : a))
        : [area, ...state.areas],
    }));

  const forget = async (id: string) => {
    removed.add(id);
    OfflineManager.removeListener(id);
    await OfflineManager.deletePack(id);
    // MapLibre keeps a deleted area's tiles in its automatic cache (the map
    // you've looked at online), so they'd still show offline and still take
    // room. Clearing that cache frees the space as the delete promised; it
    // refills by itself as you use the map online. Other areas are kept.
    await OfflineManager.clearAmbientCache().catch((e: unknown) =>
      console.warn('Could not clear the map cache', e),
    );
    set((state) => ({ areas: state.areas.filter((a) => a.id !== id) }));
  };

  const onProgress = (pack: OfflinePack, status: OfflinePackStatus) => {
    if (removed.has(pack.id)) return;
    // OpenFreeMap allows 50 MB per download. Mountains stay far below it;
    // a city's dense streets may not, and the tile count can't tell.
    if (status.state !== 'complete' && status.completedResourceSize > MAX_BYTES) {
      void pack.pause().finally(() => forget(pack.id));
      set({
        error: 'That area has too much detail to download (over 50 MB). Try a smaller area.',
      });
      return;
    }
    show(toArea(pack, status));
  };

  const onError = (_pack: OfflinePack, error: { message: string }) => {
    console.warn('Offline map download failed', error.message);
    set({ error: 'The download stopped. Check your connection and tap Resume.' });
  };

  return {
    areas: [],
    loaded: false,
    error: null,
    currentVersion: null,

    load: async () => {
      // MapLibre's own cap (6,000 tiles on the whole phone) would stop a
      // second area; the 2 GB storage limit is checked by size instead.
      OfflineManager.setTileCountLimit(200_000);
      const packs = await OfflineManager.getPacks();
      const areas = await Promise.all(
        packs.map(async (pack) => {
          const status = await pack.status().catch(() => null);
          // Still downloading from earlier: keep following its progress.
          if (status?.state === 'active') {
            await OfflineManager.addListener(pack.id, onProgress, onError);
          }
          return toArea(pack, status);
        }),
      );
      areas.sort((a, b) => b.downloadedAt - a.downloadedAt);
      set({ areas, loaded: true });
      const currentVersion = await currentMapVersion();
      if (currentVersion) set({ currentVersion });
    },

    download: async (name, bounds) => {
      set({ error: null });
      const version = await currentMapVersion();
      if (version) set({ currentVersion: version });
      const pack = await OfflineManager.createPack(
        {
          mapStyle: MAP_STYLE_URLS.dark,
          bounds,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          metadata: { name: name.trim(), downloadedAt: Date.now(), version },
        },
        onProgress,
        onError,
      );
      show(toArea(pack, null));
    },

    resume: async (id) => {
      set({ error: null });
      const pack = await OfflineManager.getPack(id);
      await OfflineManager.addListener(id, onProgress, onError);
      await pack.resume();
    },

    remove: (id) => forget(id),

    update: async (id) => {
      const area = get().areas.find((a) => a.id === id);
      if (!area) return;
      // A fresh download rather than MapLibre's in-place refresh: the new
      // version's tiles all have new addresses, and the old ones would stay.
      await forget(id);
      await get().download(area.name, area.bounds);
    },

    clearError: () => set({ error: null }),
  };
});
