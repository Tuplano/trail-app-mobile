import type { components } from '@/api/schema';

import type { Db } from './types';

/**
 * One GPS fix, in the same shape the API's POST /hikes/:id/points takes, so
 * sync can upload rows as they come out of the database.
 */
export type TrackPoint = components['schemas']['UploadPointsDto']['points'][number];

/** A fix from the location task, before it has a place (seq) in the hike. */
export type NewTrackPoint = Omit<TrackPoint, 'seq'>;

type TrackPointRow = {
  seq: number;
  recorded_at: number;
  lat: number;
  lng: number;
  altitude_m: number | null;
  accuracy_m: number | null;
  speed_mps: number | null;
};

/** Points per INSERT. SQLite caps bound values per statement; 500 × 7 stays far below it. */
const INSERT_BATCH = 500;

/**
 * Appends points to a hike, numbering them after the ones already saved
 * (0, 1, 2… with no gaps). Each batch is a single INSERT that reads the next
 * seq itself, so it is all-or-nothing and two writers can't pick the same seq.
 */
export async function addTrackPoints(
  db: Db,
  hikeId: string,
  points: readonly NewTrackPoint[],
): Promise<void> {
  for (let start = 0; start < points.length; start += INSERT_BATCH) {
    const batch = points.slice(start, start + INSERT_BATCH);
    // VALUES columns are named column1…column7; column1 is the point's
    // position in this batch, added to the hike's next free seq.
    const values = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const params = batch.flatMap((p, i) => [
      i,
      p.recordedAt,
      p.lat,
      p.lng,
      p.altitudeM ?? null,
      p.accuracyM ?? null,
      p.speedMps ?? null,
    ]);

    await db.runAsync(
      `INSERT INTO track_points
         (hike_id, seq, recorded_at, lat, lng, altitude_m, accuracy_m, speed_mps)
       SELECT ?, next.seq + p.column1, p.column2, p.column3, p.column4, p.column5, p.column6, p.column7
       FROM (VALUES ${values}) AS p,
            (SELECT COALESCE(MAX(seq) + 1, 0) AS seq FROM track_points WHERE hike_id = ?) AS next
       ORDER BY p.column1`,
      [hikeId, ...params, hikeId],
    );
  }
}

/**
 * Just what stats need from a point: where, when, how high, and how sure the
 * GPS was (the shared rules ignore steps smaller than a fix's accuracy).
 */
export type PathPoint = Pick<TrackPoint, 'recordedAt' | 'lat' | 'lng' | 'altitudeM' | 'accuracyM'>;

/** All of a hike's points in order, with only the columns stats need. */
export async function getTrackPath(db: Db, hikeId: string): Promise<PathPoint[]> {
  const rows = await db.getAllAsync<
    Pick<TrackPointRow, 'recorded_at' | 'lat' | 'lng' | 'altitude_m' | 'accuracy_m'>
  >(
    `SELECT recorded_at, lat, lng, altitude_m, accuracy_m
     FROM track_points WHERE hike_id = ? ORDER BY seq`,
    [hikeId],
  );
  return rows.map((row) => ({
    recordedAt: row.recorded_at,
    lat: row.lat,
    lng: row.lng,
    altitudeM: row.altitude_m,
    accuracyM: row.accuracy_m,
  }));
}

/** How many points the hike has. Seqs have no gaps, so they run 0 to count - 1. */
export async function countTrackPoints(db: Db, hikeId: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM track_points WHERE hike_id = ?',
    [hikeId],
  );
  return row?.n ?? 0;
}

/** The hike's newest saved point, or null if it has none yet. */
export async function getLastTrackPoint(db: Db, hikeId: string): Promise<TrackPoint | null> {
  const row = await db.getFirstAsync<TrackPointRow>(
    `SELECT seq, recorded_at, lat, lng, altitude_m, accuracy_m, speed_mps
     FROM track_points WHERE hike_id = ? ORDER BY seq DESC LIMIT 1`,
    [hikeId],
  );
  return row ? toTrackPoint(row) : null;
}

/** A hike's points in order, starting at `fromSeq`. Sync reads them in pages of 500. */
export async function getTrackPoints(
  db: Db,
  hikeId: string,
  fromSeq = 0,
  limit = 500,
): Promise<TrackPoint[]> {
  const rows = await db.getAllAsync<TrackPointRow>(
    `SELECT seq, recorded_at, lat, lng, altitude_m, accuracy_m, speed_mps
     FROM track_points WHERE hike_id = ? AND seq >= ? ORDER BY seq LIMIT ?`,
    [hikeId, fromSeq, limit],
  );
  return rows.map(toTrackPoint);
}

function toTrackPoint(row: TrackPointRow): TrackPoint {
  return {
    seq: row.seq,
    recordedAt: row.recorded_at,
    lat: row.lat,
    lng: row.lng,
    altitudeM: row.altitude_m,
    accuracyM: row.accuracy_m,
    speedMps: row.speed_mps,
  };
}
