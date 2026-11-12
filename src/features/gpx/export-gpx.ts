import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDb } from '@/db/database';
import type { Hike } from '@/db/hikes';
import { getTrackPath } from '@/db/track-points';
import { hikeTitle } from '@/features/history/hike-summary';

import { gpxFileName, toGpx } from './gpx';

/**
 * Builds a hike's GPX file from the points saved on this phone and opens the
 * share sheet (save to Files, send to Strava, Garmin, email…). Works offline
 * and before the hike has uploaded. The whole route goes in: it's the
 * hiker's own file (privacy zones only apply to what others see in the app).
 */
export async function exportHikeGpx(hike: Hike): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing files isn't available on this phone.");
  }
  const path = await getTrackPath(await getDb(), hike.id);
  const title = hikeTitle(hike);
  const xml = toGpx({ name: title, points: path });

  // In the cache: the share sheet copies what it needs, and the phone may clear it later.
  const file = new File(Paths.cache, gpxFileName(title, hike.startedAt));
  if (file.exists) file.delete();
  file.create();
  await file.write(xml);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/gpx+xml',
    UTI: 'com.topografix.gpx',
    dialogTitle: `Share ${title}`,
  });
}
