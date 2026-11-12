import { GPX_MAX_POINTS, GpxError, gpxFileName, parseGpx, readGpxForImport, toGpx } from '../gpx';

const NOW = Date.parse('2026-11-12T00:00:00Z');

/** A GPX file as Garmin or Strava write one. */
const STRAVA = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <metadata><name>Metadata name</name><time>2026-11-01T22:10:00Z</time></metadata>
 <trk>
  <name>Mt. Pulag via Ambangeg</name>
  <type>hiking</type>
  <trkseg>
   <trkpt lat="16.5721757" lon="120.8803508"><ele>2210.4</ele><time>2026-11-01T22:10:00Z</time></trkpt>
   <trkpt lat="16.5730000" lon="120.8810000"><ele>2225.0</ele><time>2026-11-01T22:11:00Z</time></trkpt>
  </trkseg>
  <trkseg>
   <trkpt lat="16.5740000" lon="120.8820000"><ele>2241.0</ele><time>2026-11-01T22:12:00Z</time></trkpt>
  </trkseg>
 </trk>
</gpx>`;

const point = (lat: number, time?: string, extra = '') =>
  `<trkpt lat="${lat}" lon="120.88">${time ? `<time>${time}</time>` : ''}${extra}</trkpt>`;
const track = (...points: string[]) =>
  `<gpx version="1.1"><trk><trkseg>${points.join('')}</trkseg></trk></gpx>`;

describe('parseGpx', () => {
  it('reads every segment in order, with heights, times and the track name', () => {
    const { name, points } = parseGpx(STRAVA);
    expect(name).toBe('Mt. Pulag via Ambangeg');
    expect(points).toEqual([
      { lat: 16.5721757, lng: 120.8803508, altitudeM: 2210.4, recordedAt: Date.parse('2026-11-01T22:10:00Z') },
      { lat: 16.573, lng: 120.881, altitudeM: 2225, recordedAt: Date.parse('2026-11-01T22:11:00Z') },
      { lat: 16.574, lng: 120.882, altitudeM: 2241, recordedAt: Date.parse('2026-11-01T22:12:00Z') },
    ]);
  });

  it('reads namespaced tags, single quotes, self-closing points, a BOM and comments', () => {
    const xml =
      '﻿<?xml version="1.0"?><gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1">' +
      '<!-- <trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk> -->' +
      "<gpx:trk><gpx:trkseg><gpx:trkpt lon='120.5' lat='16.5'/>" +
      '<gpx:trkpt lat="16.6" lon="120.6"><gpx:ele>10</gpx:ele></gpx:trkpt></gpx:trkseg></gpx:trk></gpx:gpx>';
    expect(parseGpx(xml).points).toEqual([
      { lat: 16.5, lng: 120.5 },
      { lat: 16.6, lng: 120.6, altitudeM: 10 },
    ]);
  });

  it('undoes CDATA and entities in names', () => {
    const xml = '<gpx><trk><name><![CDATA[Tom & Jerry]]></name><trkseg></trkseg></trk></gpx>';
    expect(parseGpx(xml).name).toBe('Tom & Jerry');
    expect(parseGpx('<gpx><trk><name>A &amp; B &#233;</name></trk></gpx>').name).toBe('A & B é');
  });

  it("doesn't take a point's name for the track's", () => {
    const xml = `<gpx><trk><trkseg>${point(16.5, undefined, '<name>Point name</name>')}</trkseg></trk></gpx>`;
    expect(parseGpx(xml).name).toBeUndefined();
  });

  it('falls back to a route when there is no track, ignoring waypoints', () => {
    const xml =
      '<gpx><wpt lat="1" lon="1"><name>Summit</name></wpt><rte><name>Planned</name>' +
      '<rtept lat="16.5" lon="120.5"/><rtept lat="16.6" lon="120.6"/></rte></gpx>';
    expect(parseGpx(xml)).toEqual({
      name: 'Planned',
      points: [
        { lat: 16.5, lng: 120.5 },
        { lat: 16.6, lng: 120.6 },
      ],
    });
  });

  it('refuses a file that is not GPX, and points with bad values', () => {
    expect(() => parseGpx('<kml></kml>')).toThrow(new GpxError('not-gpx', "This isn't a GPX file."));
    expect(() => parseGpx(track('<trkpt lat="95" lon="1"/>'))).toThrow('Point 1 has no valid position.');
    expect(() => parseGpx(track('<trkpt lon="1"/>'))).toThrow('Point 1 has no valid position.');
    expect(() => parseGpx(track(point(16.5, 'yesterday')))).toThrow('Point 1 has a bad time.');
    expect(() => parseGpx(track(point(16.5, undefined, '<ele>high</ele>')))).toThrow(
      'Point 1 has a bad height.',
    );
  });
});

describe('readGpxForImport', () => {
  it('gives the track with its start and end', () => {
    const result = readGpxForImport(STRAVA, NOW);
    expect(result.name).toBe('Mt. Pulag via Ambangeg');
    expect(result.points).toHaveLength(3);
    expect(result.startedAt).toBe(Date.parse('2026-11-01T22:10:00Z'));
    expect(result.endedAt).toBe(Date.parse('2026-11-01T22:12:00Z'));
  });

  const problem = (xml: string) => {
    try {
      readGpxForImport(xml, NOW);
    } catch (error) {
      return (error as GpxError).problem;
    }
    return null;
  };

  it('needs at least 2 points, each with a time', () => {
    expect(problem(track(point(16.5, '2026-11-01T22:10:00Z')))).toBe('too-few');
    expect(problem(track(point(16.5, '2026-11-01T22:10:00Z'), point(16.6)))).toBe('no-times');
  });

  it("refuses times that go backwards or are in the future (15 min of clock drift is fine)", () => {
    expect(
      problem(track(point(16.5, '2026-11-01T22:10:00Z'), point(16.6, '2026-11-01T22:09:00Z'))),
    ).toBe('out-of-order');
    expect(
      problem(track(point(16.5, '2026-11-11T23:50:00Z'), point(16.6, '2026-11-12T00:10:00Z'))),
    ).toBeNull();
    expect(
      problem(track(point(16.5, '2026-11-11T23:50:00Z'), point(16.6, '2026-11-12T00:20:00Z'))),
    ).toBe('future');
  });

  it('caps a track at 100,000 points', () => {
    const many = Array.from({ length: GPX_MAX_POINTS + 1 }, () => '<trkpt lat="1" lon="1"/>');
    expect(problem(track(...many))).toBe('too-many');
  });
});

describe('toGpx', () => {
  it('writes a file parseGpx reads back the same', () => {
    const points = [
      { lat: 16.5, lng: 120.5, altitudeM: 2210.4, recordedAt: Date.parse('2026-11-01T22:10:00Z') },
      { lat: 16.6, lng: 120.6, altitudeM: null, recordedAt: Date.parse('2026-11-01T22:11:00Z') },
    ];
    const xml = toGpx({ name: 'Tom & Jerry <3', points });
    expect(xml).toContain('<name>Tom &amp; Jerry &lt;3</name>');
    expect(parseGpx(xml)).toEqual({
      name: 'Tom & Jerry <3',
      points: [points[0], { lat: 16.6, lng: 120.6, recordedAt: points[1].recordedAt }],
    });
  });
});

describe('gpxFileName', () => {
  it('names the file like the API: start date, then the name in plain letters', () => {
    const start = new Date(2026, 10, 1, 7, 0).getTime();
    expect(gpxFileName('Mt. Pulag — Ambangeg trail', start)).toBe('2026-11-01-mt-pulag-ambangeg-trail.gpx');
    expect(gpxFileName('Dasmariñas loop', start)).toBe('2026-11-01-dasmarinas-loop.gpx');
    expect(gpxFileName('🏔️', start)).toBe('2026-11-01-hike.gpx');
  });
});
