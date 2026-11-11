import {
  areaMeta,
  checkArea,
  dataNote,
  downloadBlocker,
  formatSize,
  isOutOfDate,
  MAX_TILES,
  STORAGE_LIMIT_BYTES,
  storageUse,
  tileCount,
  tileVersion,
  type Bounds,
} from '../offline-area';

/** A square area around a point, `km` wide. */
function square(lon: number, lat: number, km: number): Bounds {
  const dLat = km / 111 / 2;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180)) / 2;
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

// Mt. Pulag, Benguet.
const PULAG: [number, number] = [120.8869, 16.5966];

describe('tileCount', () => {
  it('counts every zoom level, one tile at the least each', () => {
    // A tiny area still needs one tile per zoom level, 6 to 14.
    expect(tileCount(square(...PULAG, 0.1))).toBeGreaterThanOrEqual(9);
    expect(tileCount(square(...PULAG, 0.1))).toBeLessThanOrEqual(9 * 4);
  });

  it('grows with the area', () => {
    expect(tileCount(square(...PULAG, 40))).toBeGreaterThan(tileCount(square(...PULAG, 10)));
  });
});

describe('checkArea', () => {
  it('lets a whole mountain range through (about 100 km across)', () => {
    const check = checkArea(square(...PULAG, 90));
    expect(check.tooBig).toBe(false);
    expect(check.tiles).toBeLessThanOrEqual(MAX_TILES);
    expect(check.estimatedBytes).toBeGreaterThan(0);
  });

  it('stops anything bigger than 3,000 tiles, like the whole of Luzon', () => {
    expect(checkArea([119.5, 12.5, 124.5, 18.7]).tooBig).toBe(true);
  });
});

describe('formatSize', () => {
  it('writes sizes as the design does', () => {
    expect(formatSize(850 * 1024)).toBe('850 KB');
    expect(formatSize(18 * 1024 * 1024)).toBe('18 MB');
    expect(formatSize(2 * 1024 ** 3)).toBe('2 GB');
    expect(formatSize(1.25 * 1024 ** 3)).toBe('1.3 GB');
    expect(formatSize(10)).toBe('1 KB');
    expect(formatSize(0)).toBe('0 MB'); // nothing downloaded yet
  });
});

describe('areaMeta', () => {
  const area = { sizeBytes: 18 * 1024 * 1024, downloadedAt: Date.UTC(2026, 9, 30, 4) };

  it('shows the size and the day for a downloaded area', () => {
    expect(areaMeta({ ...area, percent: 100, complete: true, downloading: false })).toBe(
      '18 MB · updated Oct 30',
    );
  });

  it('shows how far along one still downloading, or paused', () => {
    expect(areaMeta({ ...area, percent: 45.8, complete: false, downloading: true })).toBe(
      'Downloading · 45%',
    );
    expect(areaMeta({ ...area, percent: 45.8, complete: false, downloading: false })).toBe(
      'Paused · 45%',
    );
  });
});

describe('storageUse', () => {
  it('reads like the design, and fills the bar', () => {
    expect(storageUse(412 * 1024 * 1024)).toEqual({
      label: '412 MB of 2 GB',
      fraction: (412 * 1024 * 1024) / STORAGE_LIMIT_BYTES,
    });
    expect(storageUse(3 * 1024 ** 3).fraction).toBe(1);
  });
});

describe('downloadBlocker', () => {
  const ok = {
    name: 'Mt. Pulag',
    check: checkArea(square(...PULAG, 20)),
    online: true,
    usedBytes: 0,
  };

  it('lets a named, small enough area go when online', () => {
    expect(downloadBlocker(ok)).toBeNull();
  });

  it('asks to zoom in when the area is too big', () => {
    expect(downloadBlocker({ ...ok, check: checkArea([119.5, 12.5, 124.5, 18.7]) })).toBe(
      'This area is too big to download. Zoom in to a smaller area.',
    );
  });

  it('asks to make room when storage is full', () => {
    expect(downloadBlocker({ ...ok, usedBytes: STORAGE_LIMIT_BYTES })).toMatch(/Not enough room/);
  });

  it('needs signal, and a name', () => {
    expect(downloadBlocker({ ...ok, online: false })).toBe('Needs signal');
    expect(downloadBlocker({ ...ok, name: '  ' })).toBe('Give this area a name.');
  });
});

describe('dataNote', () => {
  it('warns on mobile data only', () => {
    expect(dataNote(false, 18 * 1024 * 1024)).toBe("You're on mobile data. This uses about 18 MB.");
    expect(dataNote(true, 18 * 1024 * 1024)).toBeNull();
    expect(dataNote(null, 18 * 1024 * 1024)).toBeNull();
  });
});

describe('tileVersion', () => {
  it("reads the version from OpenFreeMap's tile address", () => {
    expect(
      tileVersion('https://tiles.openfreemap.org/planet/20261101_080013_pt/{z}/{x}/{y}.pbf'),
    ).toBe('20261101_080013_pt');
    expect(tileVersion('https://example.com/tiles/{z}/{x}/{y}.pbf')).toBeNull();
  });
});

describe('isOutOfDate', () => {
  it('flags an area from an older version, never when a version is unknown', () => {
    expect(isOutOfDate('20261101_080013_pt', '20261108_080011_pt')).toBe(true);
    expect(isOutOfDate('20261101_080013_pt', '20261101_080013_pt')).toBe(false);
    expect(isOutOfDate(null, '20261108_080011_pt')).toBe(false);
    expect(isOutOfDate('20261101_080013_pt', null)).toBe(false);
  });
});
