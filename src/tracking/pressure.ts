import { Barometer } from 'expo-sensors';

/** One barometer reading: when it arrived (epoch ms, phone clock) and the air pressure. */
export type PressureReading = { at: number; hPa: number };

/** A fix gets the reading closest in time to it, if one is at most this far away. */
export const MAX_PAIR_GAP_MS = 10_000;

/**
 * How long readings are kept. Android can hand over GPS fixes a little late,
 * in a batch; keeping two minutes lets those still find their reading.
 */
export const KEEP_READINGS_MS = 120_000;

/** No reading for this long while listening means the sensor was stopped. */
export const STALE_AFTER_MS = 15_000;

/** One reading a second is plenty: air pressure changes slowly. */
const READ_EVERY_MS = 1000;

/**
 * The air pressure when a fix was taken: the reading closest in time to it,
 * or null if none is within `maxGapMs`. Readings are oldest first.
 */
export function pressureAt(
  readings: readonly PressureReading[],
  time: number,
  maxGapMs = MAX_PAIR_GAP_MS,
): number | null {
  let best: PressureReading | null = null;
  for (const reading of readings) {
    if (!best || Math.abs(reading.at - time) < Math.abs(best.at - time)) best = reading;
  }
  return best && Math.abs(best.at - time) <= maxGapMs ? best.hPa : null;
}

/** Adds a reading and forgets the ones too old to pair with a fix. */
export function addReading(
  readings: readonly PressureReading[],
  reading: PressureReading,
): PressureReading[] {
  const keepFrom = reading.at - KEEP_READINGS_MS;
  return [...readings.filter((r) => r.at >= keepFrom), reading];
}

/**
 * Whether the sensor has gone quiet: nothing since `lastHeardAt` (the last
 * reading, or when listening started if none came yet) for too long.
 */
export function isStale(lastHeardAt: number, now: number): boolean {
  return now - lastHeardAt > STALE_AFTER_MS;
}

// The barometer is read only while a hike records, like GPS. This lives at
// module level, not in a store, because the background location task uses it
// with no screen mounted.
let available: boolean | null = null; // null: not checked yet
let subscription: { remove: () => void } | null = null;
let readings: PressureReading[] = [];
let lastHeardAt = 0;

function listen(): void {
  Barometer.setUpdateInterval(READ_EVERY_MS);
  lastHeardAt = Date.now();
  subscription = Barometer.addListener(({ pressure }) => {
    // The measurement's own timestamp is the sensor's clock (seconds since
    // the phone booted on Android), not epoch time, so stamp it on arrival.
    const at = Date.now();
    lastHeardAt = at;
    readings = addReading(readings, { at, hPa: pressure });
  });
}

/**
 * Starts reading air pressure, if the phone has a barometer. Safe to call
 * when already started. Never throws: without readings, points are saved
 * with no pressure and heights come from GPS, as before.
 */
export async function startPressureReadings(): Promise<void> {
  if (subscription) return;
  try {
    available ??= await Barometer.isAvailableAsync();
    // Checked again after the await: a second call may have started it meanwhile.
    if (available && !subscription) listen();
  } catch (error) {
    console.warn('Could not start the barometer', error);
  }
}

/** Stops reading air pressure. Safe to call when it isn't running. */
export function stopPressureReadings(): void {
  subscription?.remove();
  subscription = null;
  readings = [];
}

/**
 * Called with each batch of fixes saved to a recording hike. Starts the
 * barometer if it isn't running (Android can restart the app in the
 * background just for GPS, with this file freshly loaded), and restarts it
 * if it went quiet.
 *
 * Why the restart: on Android, expo-sensors pauses every sensor when the app
 * goes to the background and resumes it only when the app comes back, so
 * with the screen locked it would stop after the first minute. Subscribing
 * afresh registers the sensor again, and it then keeps running in the
 * background (the GPS foreground service keeps the app alive).
 */
export function keepPressureReadingsAlive(now = Date.now()): void {
  if (!subscription) {
    void startPressureReadings();
  } else if (isStale(lastHeardAt, now)) {
    try {
      subscription.remove();
      listen();
    } catch (error) {
      subscription = null; // tried again with the next batch
      console.warn('Could not restart the barometer', error);
    }
  }
}

/** The recent readings, oldest first, to pair with fixes. */
export function getPressureReadings(): readonly PressureReading[] {
  return readings;
}
