import { atLeastSpan, boundsOf, toLineString, toLngLat, toPointFeature } from '../track-shape';

const path = [
  { lat: 14.6, lng: 121.0 },
  { lat: 14.61, lng: 120.99 },
  { lat: 14.605, lng: 121.02 },
];

describe('toLngLat', () => {
  it('puts longitude first, as maps expect', () => {
    expect(toLngLat({ lat: 14.6, lng: 121.0 })).toEqual([121.0, 14.6]);
  });
});

describe('toPointFeature', () => {
  it('turns one spot into a GeoJSON point', () => {
    expect(toPointFeature({ lat: 14.6, lng: 121.0 })).toEqual({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [121.0, 14.6] },
    });
  });
});

describe('toLineString', () => {
  it('turns the path into a GeoJSON line', () => {
    expect(toLineString(path)).toEqual({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.0, 14.6],
          [120.99, 14.61],
          [121.02, 14.605],
        ],
      },
    });
  });
});

describe('boundsOf', () => {
  it('is the box around every point, as [west, south, east, north]', () => {
    expect(boundsOf(path)).toEqual([120.99, 14.6, 121.02, 14.61]);
  });

  it('is null for an empty path', () => {
    expect(boundsOf([])).toBeNull();
  });
});

describe('atLeastSpan', () => {
  it('widens a one-point box around its center', () => {
    const [w, s, e, n] = atLeastSpan([121, 14.6, 121, 14.6], 0.004);
    expect(e - w).toBeCloseTo(0.004);
    expect(n - s).toBeCloseTo(0.004);
    expect((w + e) / 2).toBeCloseTo(121);
    expect((s + n) / 2).toBeCloseTo(14.6);
  });

  it('leaves a big enough box alone', () => {
    expect(atLeastSpan([120.99, 14.6, 121.02, 14.61], 0.004)).toEqual([120.99, 14.6, 121.02, 14.61]);
  });
});
