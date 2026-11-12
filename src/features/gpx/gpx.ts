/**
 * Reading and writing GPX 1.1, the file other GPS apps (Garmin, Strava,
 * AllTrails, phone trackers) exchange tracks in.
 *
 * The rules follow the API's own reader (trail-app-api src/geo/gpx.ts and
 * src/hikes/gpx-import.ts), so a file the phone accepts is one the server
 * accepts too. The API uses an XML library; GPX is simple enough that a few
 * patterns read it here without adding one. The server checks again anyway.
 */

/** A point as GPX has it: position, and maybe height and time. */
export type GpxPoint = {
  lat: number;
  lng: number;
  altitudeM?: number;
  recordedAt?: number;
};

export type GpxTrack = { name?: string; points: GpxPoint[] };

/** Same limits as the API's import. */
export const GPX_MAX_BYTES = 10 * 1024 * 1024;
export const GPX_MAX_POINTS = 100_000;
/** The API allows times this far ahead of its clock (phones' clocks drift). */
const CLOCK_SKEW_MS = 15 * 60 * 1000;

export type GpxProblem =
  | 'not-gpx'
  | 'bad-point'
  | 'too-few'
  | 'too-many'
  | 'no-times'
  | 'out-of-order'
  | 'future';

/** The file can't be imported; `message` says why, in words for the hiker. */
export class GpxError extends Error {
  constructor(
    readonly problem: GpxProblem,
    message: string,
  ) {
    super(message);
    this.name = 'GpxError';
  }
}

// A tag name with or without a namespace prefix: <trkpt> and <gpx:trkpt> read the same.
const tag = (name: string) => `(?:[\\w.-]+:)?${name}`;
/** Every <name ...>...</name> (or <name .../>) block: [attributes, inner text]. */
function blocks(xml: string, name: string): [string, string][] {
  const pattern = new RegExp(
    `<${tag(name)}(\\s[^>]*?)?(?:\\/>|>([\\s\\S]*?)<\\/${tag(name)}\\s*>)`,
    'g',
  );
  return [...xml.matchAll(pattern)].map((m) => [m[1] ?? '', m[2] ?? '']);
}

function attribute(attributes: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attributes);
  return match ? (match[1] ?? match[2]) : undefined;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** A tag's text, with CDATA and XML entities undone; undefined when empty. */
function text(inner: string | undefined): string | undefined {
  if (inner === undefined) return undefined;
  const value = inner
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isFinite(n) ? String.fromCodePoint(n) : all;
      }
      return ENTITIES[code] ?? all;
    })
    .trim();
  return value || undefined;
}

/** The text of the first <name> tag in `xml`. */
const childText = (xml: string, name: string) => text(blocks(xml, name)[0]?.[1]);

/** `xml` without its <name> blocks, so a parent's own tags can be read. */
const without = (xml: string, name: string) =>
  xml.replace(new RegExp(`<${tag(name)}[\\s>][\\s\\S]*?<\\/${tag(name)}\\s*>`, 'g'), '');

function toPoint([attributes, inner]: [string, string], index: number): GpxPoint {
  const where = `Point ${index + 1}`;
  const latText = attribute(attributes, 'lat');
  const lngText = attribute(attributes, 'lon');
  const lat = Number(latText);
  const lng = Number(lngText);
  if (
    !latText?.trim() ||
    !lngText?.trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    throw new GpxError('bad-point', `${where} has no valid position.`);
  }

  const point: GpxPoint = { lat, lng };
  const ele = childText(inner, 'ele');
  if (ele !== undefined) {
    const altitudeM = Number(ele);
    if (!Number.isFinite(altitudeM)) throw new GpxError('bad-point', `${where} has a bad height.`);
    point.altitudeM = altitudeM;
  }
  const time = childText(inner, 'time');
  if (time !== undefined) {
    const recordedAt = Date.parse(time);
    if (Number.isNaN(recordedAt)) throw new GpxError('bad-point', `${where} has a bad time.`);
    point.recordedAt = recordedAt;
  }
  return point;
}

/**
 * The track in a GPX file: every point of every track segment, in file order
 * (several tracks or segments are joined). A file with no track but a route
 * gives the route's points. Waypoints are ignored. Throws GpxError for a file
 * that isn't GPX or has a bad point, rather than quietly dropping points.
 */
export function parseGpx(raw: string): GpxTrack {
  // Some exporters start the file with a byte-order mark; comments can hide tags.
  const xml = raw.replace(/^﻿/, '').replace(/<!--[\s\S]*?-->/g, '');
  const root = blocks(xml, 'gpx')[0];
  if (!root) throw new GpxError('not-gpx', "This isn't a GPX file.");
  const body = root[1];

  const tracks = blocks(body, 'trk').map(([, inner]) => inner);
  const routes = blocks(body, 'rte').map(([, inner]) => inner);
  const raws = tracks.length
    ? tracks.flatMap((trk) => blocks(trk, 'trkseg').flatMap(([, seg]) => blocks(seg, 'trkpt')))
    : routes.flatMap((rte) => blocks(rte, 'rtept'));

  const metadata = blocks(body, 'metadata')[0]?.[1];
  const name =
    (tracks[0] !== undefined ? childText(without(tracks[0], 'trkseg'), 'name') : undefined) ??
    (routes[0] !== undefined ? childText(without(routes[0], 'rtept'), 'name') : undefined) ??
    (metadata !== undefined ? childText(metadata, 'name') : undefined);

  return { name, points: raws.map(toPoint) };
}

/** A GPX track the server will take: every point has a time, in order. */
export type ImportableTrack = {
  name?: string;
  points: (GpxPoint & { recordedAt: number })[];
  startedAt: number;
  endedAt: number;
};

/**
 * Reads a GPX file for import, with the API's rules: 2 to 100,000 points,
 * every point with a time (without times there's no speed, so the server
 * can't check the hike and it can't count), times never going backwards,
 * and none in the future.
 */
export function readGpxForImport(raw: string, now: number = Date.now()): ImportableTrack {
  const { name, points } = parseGpx(raw);
  if (points.length < 2) {
    throw new GpxError('too-few', 'This file has no track to import (it needs at least 2 points).');
  }
  if (points.length > GPX_MAX_POINTS) {
    throw new GpxError(
      'too-many',
      `This track has ${points.length.toLocaleString('en-US')} points; the most is ${GPX_MAX_POINTS.toLocaleString('en-US')}.`,
    );
  }

  const timed: ImportableTrack['points'] = [];
  for (const [index, point] of points.entries()) {
    if (point.recordedAt === undefined) {
      throw new GpxError(
        'no-times',
        "This track has no times, so it can't be checked or count for badges.",
      );
    }
    const previous = timed.at(-1);
    if (previous && point.recordedAt < previous.recordedAt) {
      throw new GpxError('out-of-order', `The track's times go backwards at point ${index + 1}.`);
    }
    timed.push({ ...point, recordedAt: point.recordedAt });
  }

  const startedAt = timed[0].recordedAt;
  const endedAt = timed[timed.length - 1].recordedAt;
  if (endedAt > now + CLOCK_SKEW_MS) {
    throw new GpxError('future', 'This track has times in the future.');
  }
  return { name: name?.slice(0, 100), points: timed, startedAt, endedAt };
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * A GPX 1.1 file with one track of these points, the same layout the API's
 * GET /hikes/:id/gpx writes. parseGpx reads it back.
 */
export function toGpx({
  name,
  points,
}: {
  name?: string;
  points: readonly { lat: number; lng: number; altitudeM?: number | null; recordedAt?: number }[];
}): string {
  const nameTag = name ? `<name>${escapeXml(name)}</name>` : '';
  const firstTime = points.find((p) => p.recordedAt !== undefined)?.recordedAt;
  const trkpts = points.map((p) => {
    const ele = p.altitudeM == null ? '' : `<ele>${String(p.altitudeM)}</ele>`;
    const time = p.recordedAt === undefined ? '' : `<time>${new Date(p.recordedAt).toISOString()}</time>`;
    return `      <trkpt lat="${String(p.lat)}" lon="${String(p.lng)}">${ele}${time}</trkpt>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Trailing" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata>${nameTag}${firstTime === undefined ? '' : `<time>${new Date(firstTime).toISOString()}</time>`}</metadata>`,
    `  <trk>${nameTag}`,
    '    <trkseg>',
    ...trkpts,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}

/**
 * A file name like the API's: "2026-11-01-mt-pulag.gpx" (the hike's local
 * start date, then its name in plain letters).
 */
export function gpxFileName(title: string, startedAt: number): string {
  const d = new Date(startedAt);
  const date = [d.getFullYear(), d.getMonth() + 1, d.getDate()]
    .map((n) => String(n).padStart(2, '0'))
    .join('-');
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `${date}-${slug || 'hike'}.gpx`;
}
