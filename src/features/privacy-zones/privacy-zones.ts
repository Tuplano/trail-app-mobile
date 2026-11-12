import { ApiError } from '@/api/errors';
import type { components } from '@/api/schema';
import { distanceM } from '@/tracking/geo';

export type Zone = components['schemas']['PrivacyZoneDto'];
export type NewZoneBody = components['schemas']['CreatePrivacyZoneDto'];

/** The design's radius slider: 100 to 1000 m in 50 m steps (the API takes 50–5000). */
export const RADIUS_MIN_M = 100;
export const RADIUS_MAX_M = 1000;
export const RADIUS_STEP_M = 50;
/** A new zone starts at 300 m, as in the design. */
export const NEW_ZONE_RADIUS_M = 300;
/** The API's cap per person. */
export const MAX_ZONES = 20;
/** The API's longest name. */
export const MAX_LABEL_LENGTH = 100;
/**
 * A zone moved by less than this hasn't really moved: the map's center
 * wobbles a little after easing to a zone, and that shouldn't ask to save.
 */
const MOVE_TOLERANCE_M = 5;

/**
 * The zone being edited on the screen. `id` is null for a zone that isn't
 * saved yet. Kept apart from the saved zone so Save knows what changed.
 */
export type ZoneDraft = {
  id: string | null;
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
};

export type ZoneKind = 'home' | 'work' | 'pin';

/** Which icon a zone gets from its name, like the design's house and briefcase. */
export function zoneKind(label: string | null): ZoneKind {
  const name = label?.toLowerCase() ?? '';
  if (/\b(home|house)\b/.test(name)) return 'home';
  if (/\b(office|work)\b/.test(name)) return 'work';
  return 'pin';
}

/**
 * The list's order: by name, zones without one last (oldest first). The API
 * lists oldest first, but an edit replaces a zone (see saveZoneDraft), which
 * would move it to the end every time it's saved.
 */
export function sortZones(zones: readonly Zone[]): Zone[] {
  return [...zones].sort((a, b) => {
    const nameA = a.label?.trim() ?? '';
    const nameB = b.label?.trim() ?? '';
    if (!nameA !== !nameB) return nameA ? -1 : 1;
    return (
      nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true }) ||
      a.createdAt.localeCompare(b.createdAt)
    );
  });
}

/** A zone's name in lists; zones saved without a name are numbered. */
export function zoneName(label: string | null, index: number): string {
  return label?.trim() || `Zone ${index + 1}`;
}

/** "Zone 3" for the third zone, skipping a number that's already taken. */
export function newZoneLabel(zones: readonly { label: string | null }[]): string {
  const taken = new Set(zones.map((zone, i) => zoneName(zone.label, i)));
  let n = zones.length + 1;
  while (taken.has(`Zone ${n}`)) n++;
  return `Zone ${n}`;
}

/** Rounds a slider position to the nearest 50 m inside the design's range. */
export function snapRadius(meters: number): number {
  const stepped = Math.round(meters / RADIUS_STEP_M) * RADIUS_STEP_M;
  return Math.min(RADIUS_MAX_M, Math.max(RADIUS_MIN_M, stepped));
}

export function draftFromZone(zone: Zone): ZoneDraft {
  return {
    id: zone.id,
    label: zone.label ?? '',
    lat: zone.lat,
    lng: zone.lng,
    radiusM: zone.radiusM,
  };
}

/** A new zone, not saved yet, where the map is centered. */
export function newDraft(
  center: { lat: number; lng: number },
  zones: readonly { label: string | null }[],
): ZoneDraft {
  return {
    id: null,
    label: newZoneLabel(zones),
    lat: center.lat,
    lng: center.lng,
    radiusM: NEW_ZONE_RADIUS_M,
  };
}

/** True when Save has something to do: a new zone, or a changed name, size or place. */
export function draftChanged(saved: Zone | undefined, draft: ZoneDraft): boolean {
  if (!saved || draft.id === null) return true;
  return (
    (saved.label ?? '') !== draft.label.trim() ||
    saved.radiusM !== draft.radiusM ||
    distanceM(saved, draft) > MOVE_TOLERANCE_M
  );
}

/** Why a new zone can't be added, or null when it can. */
export function addBlocker(zoneCount: number): string | null {
  return zoneCount >= MAX_ZONES
    ? `You can have up to ${MAX_ZONES} zones. Remove one to add another.`
    : null;
}

export function toBody(draft: ZoneDraft): NewZoneBody {
  return {
    label: draft.label.trim() || null,
    lat: draft.lat,
    lng: draft.lng,
    radiusM: draft.radiusM,
  };
}

/** Earth's mean radius, as in tracking/geo.ts. */
const EARTH_RADIUS_M = 6_371_000;

/**
 * A zone's circle as a GeoJSON polygon the map can fill. Each corner is the
 * point `radiusM` away from the center in one direction, so the circle keeps
 * its true size on the ground at any latitude.
 */
export function circlePolygon(
  center: { lat: number; lng: number },
  radiusM: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const lat1 = (center.lat * Math.PI) / 180;
  const lng1 = (center.lng * Math.PI) / 180;
  const angular = radiusM / EARTH_RADIUS_M;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * (i % steps)) / steps;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
      );
    ring.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

/** The zones' names in a short line, like the design's "Home and Office". */
export function zonesSummary(labels: readonly (string | null)[]): string {
  const names = labels.map((label, i) => zoneName(label, i));
  if (names.length <= 1) return names[0] ?? '';
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

export type ZoneApi = {
  create: (body: NewZoneBody) => Promise<Zone>;
  /** Resolves when the zone is gone, also when it was already gone. */
  remove: (id: string) => Promise<void>;
};

export type SaveResult = {
  zone: Zone;
  /** False when the edited zone's old copy couldn't be removed: both now show. */
  oldRemoved: boolean;
};

const isLimit = (e: unknown) => e instanceof ApiError && e.code === 'PRIVACY_ZONE_LIMIT';

/**
 * Saves a draft. The API can't edit a zone, so an edit adds the new zone and
 * then removes the old one. Adding first means the place is never left
 * uncovered, even for a moment or when the second step fails.
 *
 * At the 20-zone cap the add is refused, so the old zone goes first; if the
 * add then fails, the old zone (`saved`) is put back.
 */
export async function saveZoneDraft(
  draft: ZoneDraft,
  saved: Zone | undefined,
  zoneApi: ZoneApi,
): Promise<SaveResult> {
  const body = toBody(draft);
  if (draft.id === null || !saved) return { zone: await zoneApi.create(body), oldRemoved: true };

  let zone: Zone;
  try {
    zone = await zoneApi.create(body);
  } catch (e) {
    if (!isLimit(e)) throw e;
    await zoneApi.remove(saved.id);
    try {
      return { zone: await zoneApi.create(body), oldRemoved: true };
    } catch (addError) {
      await zoneApi.create(toBody(draftFromZone(saved))).catch((restoreError: unknown) => {
        console.warn('Could not put the old zone back', restoreError);
      });
      throw addError;
    }
  }

  try {
    await zoneApi.remove(saved.id);
    return { zone, oldRemoved: true };
  } catch (e) {
    console.warn('Saved the new zone but could not remove the old one', e);
    return { zone, oldRemoved: false };
  }
}
