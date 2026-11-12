import { photonUrl, RESULT_LIMIT, searchView, toPlaces } from '../place-search';

/** Trimmed from a real Photon answer for "Mt Pulag". */
const PULAG = {
  type: 'FeatureCollection',
  features: [
    {
      geometry: { type: 'Point', coordinates: [120.9064777, 16.5839457] },
      properties: {
        osm_type: 'W',
        osm_id: 320168582,
        name: 'Mt. Pulag Camp 2',
        state: 'Benguet',
        country: 'Philippines',
        extent: [120.90609, 16.5844386, 120.907072, 16.5834166],
      },
    },
    {
      geometry: { type: 'Point', coordinates: [120.8338286, 16.5207694] },
      properties: {
        osm_type: 'W',
        osm_id: 320168583,
        name: 'Mt. Pulag DENR PAO',
        district: 'Busok',
        city: 'Bokod',
        state: 'Benguet',
        country: 'Philippines',
      },
    },
  ],
};

describe('photonUrl', () => {
  it('asks for a few English results for the trimmed words', () => {
    const url = new URL(photonUrl('  Mt Pulag '));
    expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api/');
    expect(url.searchParams.get('q')).toBe('Mt Pulag');
    expect(url.searchParams.get('limit')).toBe(String(RESULT_LIMIT));
    expect(url.searchParams.get('lang')).toBe('en');
    expect(url.searchParams.has('lat')).toBe(false);
  });

  it('ranks places near the map first, sending only a rounded position', () => {
    const url = new URL(photonUrl('Camp 2', [120.886912345, 16.596612345]));
    expect(url.searchParams.get('lon')).toBe('120.8869');
    expect(url.searchParams.get('lat')).toBe('16.5966');
  });
});

describe('toPlaces', () => {
  it('reads name, where it is, position and area', () => {
    expect(toPlaces(PULAG)).toEqual([
      {
        id: 'W320168582',
        name: 'Mt. Pulag Camp 2',
        detail: 'Benguet, Philippines',
        lat: 16.5839457,
        lng: 120.9064777,
        // Photon's [minLon, maxLat, maxLon, minLat] turned into [west, south, east, north].
        bounds: [120.90609, 16.5834166, 120.907072, 16.5844386],
      },
      {
        id: 'W320168583',
        name: 'Mt. Pulag DENR PAO',
        detail: 'Bokod, Benguet, Philippines',
        lat: 16.5207694,
        lng: 120.8338286,
        bounds: null,
      },
    ]);
  });

  it('skips duplicates, places without a name or position, and odd answers', () => {
    const odd = {
      features: [
        PULAG.features[0],
        PULAG.features[0],
        { geometry: { coordinates: [1, 2] }, properties: {} },
        { geometry: {}, properties: { name: 'Nowhere' } },
      ],
    };
    expect(toPlaces(odd).map((place) => place.name)).toEqual(['Mt. Pulag Camp 2']);
    expect(toPlaces(null)).toEqual([]);
    expect(toPlaces({ message: 'error' })).toEqual([]);
  });

  it("doesn't repeat the name in the detail line", () => {
    const town = {
      features: [
        {
          geometry: { coordinates: [120.59, 16.41] },
          properties: { osm_type: 'R', osm_id: 1, name: 'Baguio', city: 'Baguio', country: 'Philippines' },
        },
      ],
    };
    expect(toPlaces(town)[0].detail).toBe('Philippines');
  });
});

describe('searchView', () => {
  const base = { query: 'pulag', isFetching: false, isError: false, count: 0, online: true };

  it('waits for 3 letters', () => {
    expect(searchView({ ...base, query: ' pu ' })).toEqual({ kind: 'idle' });
  });

  it('keeps showing results while the next search runs', () => {
    expect(searchView({ ...base, count: 2, isFetching: true })).toEqual({ kind: 'results' });
  });

  it('spins, then says nothing matched', () => {
    expect(searchView({ ...base, isFetching: true })).toEqual({ kind: 'loading' });
    expect(searchView(base)).toEqual({ kind: 'none', query: 'pulag' });
  });

  it('says why when it cannot search', () => {
    expect(searchView({ ...base, online: false })).toEqual({ kind: 'offline' });
    expect(searchView({ ...base, isError: true })).toEqual({ kind: 'error' });
  });
});
