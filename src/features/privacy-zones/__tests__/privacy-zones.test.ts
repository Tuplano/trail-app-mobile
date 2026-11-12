import { ApiError } from '@/api/errors';
import { haversineDistance as distanceM } from '@/tracking/geo/distance';

import {
  addBlocker,
  circlePolygon,
  draftChanged,
  draftFromZone,
  MAX_ZONES,
  newDraft,
  newZoneLabel,
  type NewZoneBody,
  saveZoneDraft,
  snapRadius,
  sortZones,
  type Zone,
  type ZoneApi,
  zoneKind,
  zoneName,
  zonesSummary,
} from '../privacy-zones';

const HOME: Zone = {
  id: 'zone-home',
  label: 'Home',
  lat: 14.6,
  lng: 121.0,
  radiusM: 500,
  createdAt: '2026-11-01T00:00:00.000Z',
};

/** A fake API that keeps zones in a list, and can be told to refuse things. */
function fakeApi(start: Zone[], { limit = MAX_ZONES, failRemove = false } = {}) {
  const zones = [...start];
  let next = 1;
  const api: ZoneApi = {
    create: jest.fn(async (body: NewZoneBody) => {
      if (zones.length >= limit) {
        throw new ApiError('Limit reached', 409, 'PRIVACY_ZONE_LIMIT');
      }
      const zone = { ...body, label: body.label ?? null, id: `new-${next++}`, createdAt: '' };
      zones.push(zone);
      return zone;
    }),
    remove: jest.fn(async (id: string) => {
      if (failRemove) throw new TypeError('Network request failed');
      const at = zones.findIndex((zone) => zone.id === id);
      if (at >= 0) zones.splice(at, 1);
    }),
  };
  return { api, zones };
}

describe('zoneKind', () => {
  it('gives home and office the design icons, anything else a pin', () => {
    expect(zoneKind('Home')).toBe('home');
    expect(zoneKind("Mom's house")).toBe('home');
    expect(zoneKind('Office')).toBe('work');
    expect(zoneKind('work')).toBe('work');
    expect(zoneKind('Gym')).toBe('pin');
    expect(zoneKind(null)).toBe('pin');
  });

  it('matches whole words only', () => {
    expect(zoneKind('Homestead trailhead')).toBe('pin');
  });
});

describe('zoneName and newZoneLabel', () => {
  it('numbers zones saved without a name', () => {
    expect(zoneName(null, 0)).toBe('Zone 1');
    expect(zoneName('  ', 2)).toBe('Zone 3');
    expect(zoneName(' Home ', 0)).toBe('Home');
  });

  it('names a new zone after the count, skipping names in use', () => {
    expect(newZoneLabel([])).toBe('Zone 1');
    expect(newZoneLabel([{ label: 'Home' }, { label: 'Office' }])).toBe('Zone 3');
    expect(newZoneLabel([{ label: 'Zone 2' }])).toBe('Zone 3');
  });
});

describe('sortZones', () => {
  it('sorts by name, unnamed zones last and oldest first, so an edit keeps its place', () => {
    const zone = (id: string, label: string | null, createdAt: string): Zone => ({
      ...HOME,
      id,
      label,
      createdAt,
    });
    const sorted = sortZones([
      zone('a', null, '2026-11-02'),
      zone('b', 'office', '2026-11-01'),
      zone('c', 'Home', '2026-11-05'),
      zone('d', null, '2026-11-01'),
      zone('e', 'Zone 10', '2026-11-01'),
      zone('f', 'Zone 9', '2026-11-01'),
    ]);
    expect(sorted.map((z) => z.id)).toEqual(['c', 'b', 'f', 'e', 'd', 'a']);
  });
});

describe('snapRadius', () => {
  it('rounds to 50 m and stays inside 100–1000 m', () => {
    expect(snapRadius(324)).toBe(300);
    expect(snapRadius(326)).toBe(350);
    expect(snapRadius(0)).toBe(100);
    expect(snapRadius(5000)).toBe(1000);
  });
});

describe('draftChanged', () => {
  it('has nothing to save for an untouched zone', () => {
    expect(draftChanged(HOME, draftFromZone(HOME))).toBe(false);
  });

  it('ignores a tiny wobble of the map center', () => {
    // About 1 m north.
    expect(draftChanged(HOME, { ...draftFromZone(HOME), lat: HOME.lat + 0.00001 })).toBe(false);
  });

  it('sees a move, a new size or a new name', () => {
    expect(draftChanged(HOME, { ...draftFromZone(HOME), lat: HOME.lat + 0.001 })).toBe(true);
    expect(draftChanged(HOME, { ...draftFromZone(HOME), radiusM: 550 })).toBe(true);
    expect(draftChanged(HOME, { ...draftFromZone(HOME), label: 'House' })).toBe(true);
  });

  it('treats a name with only extra spaces as the same', () => {
    expect(draftChanged(HOME, { ...draftFromZone(HOME), label: 'Home ' })).toBe(false);
  });

  it('always saves a new zone', () => {
    expect(draftChanged(undefined, newDraft(HOME, []))).toBe(true);
  });
});

describe('addBlocker', () => {
  it('stops at the API cap of 20', () => {
    expect(addBlocker(19)).toBeNull();
    expect(addBlocker(20)).toMatch(/up to 20 zones/);
  });
});

describe('circlePolygon', () => {
  it('draws a closed ring the right distance from the center', () => {
    const circle = circlePolygon(HOME, 500, 32);
    const ring = circle.geometry.coordinates[0];
    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring[32]);
    for (const [lng, lat] of ring) {
      expect(distanceM(HOME, { lat, lng })).toBeCloseTo(500, 0);
    }
  });
});

describe('zonesSummary', () => {
  it('reads like the design', () => {
    expect(zonesSummary([])).toBe('');
    expect(zonesSummary(['Home'])).toBe('Home');
    expect(zonesSummary(['Home', 'Office'])).toBe('Home and Office');
    expect(zonesSummary(['Home', 'Office', null])).toBe('Home, Office and Zone 3');
    expect(zonesSummary(['Home', 'Office', 'Gym', 'Mom'])).toBe('Home, Office and 2 more');
  });
});

describe('saveZoneDraft', () => {
  it('adds a new zone, with an empty name sent as none', async () => {
    const { api, zones } = fakeApi([]);
    const draft = { ...newDraft(HOME, []), label: ' ' };
    const result = await saveZoneDraft(draft, undefined, api);
    expect(result.oldRemoved).toBe(true);
    expect(zones).toEqual([result.zone]);
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ label: null, radiusM: 300 }));
  });

  it('replaces an edited zone: adds the new one before removing the old', async () => {
    const { api, zones } = fakeApi([HOME]);
    const order: string[] = [];
    (api.create as jest.Mock).mockImplementationOnce(async (body: NewZoneBody) => {
      order.push('create');
      const zone = { ...body, label: body.label ?? null, id: 'new-1', createdAt: '' };
      zones.push(zone);
      return zone;
    });
    (api.remove as jest.Mock).mockImplementationOnce(async (id: string) => {
      order.push('remove');
      zones.splice(zones.findIndex((zone) => zone.id === id), 1);
    });

    const result = await saveZoneDraft({ ...draftFromZone(HOME), radiusM: 700 }, HOME, api);
    expect(order).toEqual(['create', 'remove']);
    expect(zones).toEqual([expect.objectContaining({ id: 'new-1', radiusM: 700, label: 'Home' })]);
    expect(result.oldRemoved).toBe(true);
  });

  it('keeps the new zone and says so when the old one cannot be removed', async () => {
    const { api, zones } = fakeApi([HOME], { failRemove: true });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await saveZoneDraft({ ...draftFromZone(HOME), radiusM: 700 }, HOME, api);
    expect(result.oldRemoved).toBe(false);
    // Both cover the place: nothing is left uncovered.
    expect(zones.map((zone) => zone.radiusM)).toEqual([500, 700]);
    warn.mockRestore();
  });

  it('changes nothing when the add fails for another reason', async () => {
    const { api, zones } = fakeApi([HOME]);
    (api.create as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(
      saveZoneDraft({ ...draftFromZone(HOME), radiusM: 700 }, HOME, api),
    ).rejects.toThrow('Network request failed');
    expect(zones).toEqual([HOME]);
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('at the cap, removes the old zone first, then adds the new one', async () => {
    const { api, zones } = fakeApi([HOME], { limit: 1 });
    const result = await saveZoneDraft({ ...draftFromZone(HOME), radiusM: 700 }, HOME, api);
    expect(zones).toEqual([result.zone]);
    expect(result.zone.radiusM).toBe(700);
  });

  it('at the cap, puts the old zone back when the new one is refused', async () => {
    const { api, zones } = fakeApi([HOME], { limit: 1 });
    (api.create as jest.Mock)
      .mockRejectedValueOnce(new ApiError('Limit reached', 409, 'PRIVACY_ZONE_LIMIT'))
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(
      saveZoneDraft({ ...draftFromZone(HOME), radiusM: 700 }, HOME, api),
    ).rejects.toThrow('Network request failed');
    expect(zones).toEqual([
      expect.objectContaining({ label: 'Home', lat: HOME.lat, lng: HOME.lng, radiusM: 500 }),
    ]);
  });
});
