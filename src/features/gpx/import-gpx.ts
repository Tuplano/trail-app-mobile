import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

import { getDb } from '@/db/database';
import { createImportedHike, findOverlappingHike, type ImportedHikeInput } from '@/db/hikes';
import { uuidv7 } from '@/db/ids';
import { formatHikeDate, hikeTitle } from '@/features/history/hike-summary';
import { queueFinishedHikes } from '@/sync/queue-hikes';
import { requestSync } from '@/sync/sync';
import { deleteImportFile } from '@/sync/upload-import';
import { computeStats } from '@/tracking/hike-stats';

import { GPX_MAX_BYTES, GpxError, type ImportableTrack, readGpxForImport } from './gpx';

export type ImportResult =
  | { kind: 'imported'; hikeId: string }
  | { kind: 'canceled' }
  | { kind: 'problem'; message: string };

/**
 * The hike to save for a track read from a GPX file. Its id is made from the
 * track's start time, like a recorded hike's; the stats are the phone's own
 * until the server has processed it, as for a recorded hike.
 */
export function toImportedHike(
  track: ImportableTrack,
  id: string,
  fileUri: string,
): ImportedHikeInput {
  const points = track.points.map((p) => ({
    recordedAt: p.recordedAt,
    lat: p.lat,
    lng: p.lng,
    altitudeM: p.altitudeM ?? null,
  }));
  return {
    id,
    title: track.name?.trim() || null,
    startedAt: track.startedAt,
    endedAt: track.endedAt,
    fileUri,
    stats: computeStats(points),
    points,
  };
}

/**
 * The app's own folder for imported files waiting to upload. The picker's
 * copy is in the cache, which the phone may clear before there's signal.
 */
function importsFolder(): Directory {
  const folder = new Directory(Paths.document, 'gpx-imports');
  folder.create({ idempotent: true, intermediates: true });
  return folder;
}

/**
 * Lets the hiker pick a .gpx file, checks it, and saves it as a finished
 * hike on this phone (so it's in History right away, offline too). The
 * outbox then uploads the file to the API. Problems come back as a sentence
 * to show, not as an error.
 */
export async function importGpx(now: number = Date.now()): Promise<ImportResult> {
  // Any type: phones rarely know .gpx's type, so the file is judged by what's in it.
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (picked.canceled) return { kind: 'canceled' };
  const asset = picked.assets[0];
  try {
    return await importPicked(asset, now);
  } finally {
    // The picker's copy in the cache isn't needed once the app has its own.
    deleteImportFile(asset.uri);
  }
}

async function importPicked(
  asset: DocumentPicker.DocumentPickerAsset,
  now: number,
): Promise<ImportResult> {
  const source = new File(asset.uri);
  if ((asset.size ?? source.size) > GPX_MAX_BYTES) {
    return { kind: 'problem', message: 'This file is over 10 MB, the most that can be imported.' };
  }

  let track: ImportableTrack;
  try {
    track = readGpxForImport(await source.text(), now);
  } catch (error) {
    if (error instanceof GpxError) return { kind: 'problem', message: error.message };
    throw error;
  }

  const db = await getDb();
  const overlap = await findOverlappingHike(db, track.startedAt, track.endedAt);
  if (overlap) {
    return {
      kind: 'problem',
      message: `You already have a hike at that time: “${hikeTitle(overlap)}”, ${formatHikeDate(overlap.startedAt)}. It's probably the same hike.`,
    };
  }

  const id = uuidv7(track.startedAt);
  const copy = new File(importsFolder(), `${id}.gpx`);
  await source.copy(copy);
  try {
    await createImportedHike(db, toImportedHike(track, id, copy.uri));
  } catch (error) {
    deleteImportFile(copy.uri);
    throw error;
  }

  await queueFinishedHikes();
  void requestSync();
  return { kind: 'imported', hikeId: id };
}
