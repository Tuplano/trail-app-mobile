/**
 * The map's look and its tile server, per app theme. OpenFreeMap: free, no
 * API key, OpenStreetMap data (no contour lines). "dark" matches the design's
 * dark screens; "liberty" (light) shows more detail, such as footpaths.
 * To switch to an outdoor style later (e.g. MapTiler Outdoor), change these URLs.
 */
export const MAP_STYLE_URLS = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/liberty',
} as const;

/** How close the map starts when following the hiker. ~15 shows a few streets. */
export const FOLLOW_ZOOM = 16;
