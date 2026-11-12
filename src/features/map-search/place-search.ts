/**
 * Place search for the maps, using Photon: a free search over OpenStreetMap,
 * the same data the map tiles come from (so trailheads, peaks and camp sites
 * are found, not only addresses). No API key. It's a shared free service, so
 * the app searches only after typing pauses and asks for a few results.
 * https://photon.komoot.io
 */
const PHOTON_URL = 'https://photon.komoot.io/api/';
/** How many places to show under the search box. */
export const RESULT_LIMIT = 5;
/** Fewer letters than this match too much to be useful. */
export const MIN_QUERY_LENGTH = 3;

/** A place to move the map to. */
export type Place = {
  id: string;
  name: string;
  /** Where it is, e.g. "Bokod, Benguet, Philippines". */
  detail: string;
  lat: number;
  lng: number;
  /** [west, south, east, north], when the place is an area (a town, a park). */
  bounds: [number, number, number, number] | null;
};

/**
 * The search address. `near` ([longitude, latitude], usually the map's
 * center) ranks places close to it first, so "Camp 2" finds the one on
 * your mountain.
 */
export function photonUrl(query: string, near?: [number, number] | null): string {
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(RESULT_LIMIT),
    // Photon only knows default, de, en and fr; English matches the app.
    lang: 'en',
  });
  if (near) {
    params.set('lon', near[0].toFixed(4));
    params.set('lat', near[1].toFixed(4));
  }
  return `${PHOTON_URL}?${params.toString()}`;
}

type PhotonFeature = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, unknown>;
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * Photon's answer (GeoJSON points) as places. Skips anything without a
 * position or a name, and the same place listed twice.
 */
export function toPlaces(body: unknown): Place[] {
  const features = (body as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];

  const places: Place[] = [];
  const seen = new Set<string>();
  for (const feature of features as PhotonFeature[]) {
    const p = feature.properties ?? {};
    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
    const [lng, lat] = coordinates as number[];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    const name = text(p.name) ?? text(p.street) ?? text(p.city);
    if (!name) continue;
    const id = `${String(p.osm_type ?? '')}${String(p.osm_id ?? `${lng},${lat}`)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    // Photon's extent is [minLon, maxLat, maxLon, minLat].
    const extent = Array.isArray(p.extent) && p.extent.length === 4 ? (p.extent as number[]) : null;
    const where = [p.city ?? p.district, p.state, p.country]
      .map(text)
      .filter((part): part is string => part !== null && part !== name);

    places.push({
      id,
      name,
      detail: [...new Set(where)].join(', '),
      lat,
      lng,
      bounds: extent ? [extent[0], extent[3], extent[2], extent[1]] : null,
    });
  }
  return places;
}

export type SearchView =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results' }
  | { kind: 'none'; query: string }
  | { kind: 'offline' }
  | { kind: 'error' };

/** What to show under the search box. */
export function searchView({
  query,
  isFetching,
  isError,
  count,
  online,
}: {
  query: string;
  isFetching: boolean;
  isError: boolean;
  count: number;
  online: boolean;
}): SearchView {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return { kind: 'idle' };
  if (count > 0) return { kind: 'results' };
  if (!online) return { kind: 'offline' };
  if (isFetching) return { kind: 'loading' };
  if (isError) return { kind: 'error' };
  return { kind: 'none', query: q };
}
