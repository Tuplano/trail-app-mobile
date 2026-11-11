/**
 * The rules for downloading map areas to use without signal. The numbers
 * come from OpenFreeMap's terms (https://openfreemap.org/tos): each download
 * at most 3,000 tiles or 50 MB, with at most 4 requests at a time (that last
 * one is set natively, see plugins/with-map-requests.js).
 */

/** [west, south, east, north] in degrees, as MapLibre gives a map's visible area. */
export type Bounds = [west: number, south: number, east: number, north: number];

/** OpenFreeMap's limits for one download. */
export const MAX_TILES = 3000;
export const MAX_BYTES = 50 * 1024 * 1024;

/**
 * Zoom levels saved. Below 6 there's nothing a hiker needs; above 14 there's
 * no more detail (OpenFreeMap's tiles stop at 14, the map enlarges those).
 */
export const MIN_ZOOM = 6;
export const MAX_ZOOM = 14;

/** All downloaded areas together, as in the design's "412 MB of 2 GB". */
export const STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Average size of a tile, for the estimate before downloading. A first guess
 * for mountain areas (few roads and buildings), to adjust after more real
 * downloads; a city area is bigger, which the 50 MB check catches while it
 * downloads.
 */
export const BYTES_PER_TILE_ESTIMATE = 12_000;

/** The tile column for a longitude at a zoom level (Web Mercator, like every web map). */
function tileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

/** The tile row for a latitude at a zoom level. */
function tileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

/** How many map tiles cover an area, over all the zoom levels saved. */
export function tileCount(bounds: Bounds, minZoom = MIN_ZOOM, maxZoom = MAX_ZOOM): number {
  const [west, south, east, north] = bounds;
  let count = 0;
  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    const columns = tileX(east, zoom) - tileX(west, zoom) + 1;
    const rows = tileY(south, zoom) - tileY(north, zoom) + 1;
    count += columns * rows;
  }
  return count;
}

export type AreaCheck = {
  tiles: number;
  /** A rough size, for "About 18 MB". */
  estimatedBytes: number;
  /** Over OpenFreeMap's 3,000 tiles: the hiker has to zoom in. */
  tooBig: boolean;
};

/** Whether the area on the map can be downloaded, and roughly how big it is. */
export function checkArea(bounds: Bounds): AreaCheck {
  const tiles = tileCount(bounds);
  return {
    tiles,
    estimatedBytes: tiles * BYTES_PER_TILE_ESTIMATE,
    tooBig: tiles > MAX_TILES,
  };
}

/** "850 KB", "18 MB", "1.2 GB": sizes as the design writes them. */
export function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const kb = bytes / 1024;
  if (kb < 1000) return `${Math.max(1, Math.round(kb))} KB`;
  const mb = kb / 1024;
  if (mb < 1000) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1).replace(/\.0$/, '')} GB`;
}

/**
 * The line under a downloaded area's name, as in the design:
 * "286 MB · updated Oct 30". While it downloads: "Downloading · 45%".
 */
export function areaMeta(area: {
  sizeBytes: number;
  downloadedAt: number;
  percent: number;
  complete: boolean;
  downloading: boolean;
}): string {
  if (area.complete) {
    const date = new Date(area.downloadedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${formatSize(area.sizeBytes)} · updated ${date}`;
  }
  const percent = `${Math.floor(area.percent)}%`;
  return area.downloading ? `Downloading · ${percent}` : `Paused · ${percent}`;
}

/** The design's storage card: "412 MB of 2 GB", and how full the bar is. */
export function storageUse(usedBytes: number): { label: string; fraction: number } {
  return {
    label: `${formatSize(usedBytes)} of ${formatSize(STORAGE_LIMIT_BYTES)}`,
    fraction: Math.min(1, usedBytes / STORAGE_LIMIT_BYTES),
  };
}

/**
 * What stops a download, or what to know before it, in the order a hiker
 * would fix them. Null when it can go.
 */
export function downloadBlocker(state: {
  name: string;
  check: AreaCheck;
  online: boolean | null;
  usedBytes: number;
}): string | null {
  if (state.check.tooBig) return 'This area is too big to download. Zoom in to a smaller area.';
  if (state.usedBytes + state.check.estimatedBytes > STORAGE_LIMIT_BYTES) {
    return 'Not enough room: delete an area you no longer need first.';
  }
  if (state.online === false) return 'Needs signal';
  if (state.name.trim().length === 0) return 'Give this area a name.';
  return null;
}

/** A heads-up on mobile data, where prepaid data is costly. Null on Wi-Fi. */
export function dataNote(unmetered: boolean | null, estimatedBytes: number): string | null {
  if (unmetered !== false) return null;
  return `You're on mobile data. This uses about ${formatSize(estimatedBytes)}.`;
}

/**
 * The map data version in an OpenFreeMap tile address, e.g.
 * ".../planet/20261101_080013_pt/{z}/{x}/{y}.pbf" → "20261101_080013_pt".
 * OpenFreeMap publishes a new version every week or so, at new addresses.
 * A downloaded area holds one version's tiles; once the map moves on to a
 * newer one, the phone may look for tiles the area doesn't have, so the area
 * needs updating before it's relied on offline.
 */
export function tileVersion(tileUrl: string): string | null {
  return /\/planet\/([^/]+)\/\{z\}/.exec(tileUrl)?.[1] ?? null;
}

/** An area downloaded from an older map version than the current one. */
export function isOutOfDate(areaVersion: string | null, currentVersion: string | null): boolean {
  return areaVersion !== null && currentVersion !== null && areaVersion !== currentVersion;
}
