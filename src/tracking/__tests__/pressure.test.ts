import type { BarometerMeasurement } from 'expo-sensors';

import {
  addReading,
  isStale,
  KEEP_READINGS_MS,
  MAX_PAIR_GAP_MS,
  type PressureReading,
  pressureAt,
  STALE_AFTER_MS,
} from '../pressure';

jest.mock('expo-sensors', () => ({
  Barometer: {
    isAvailableAsync: jest.fn(),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(),
  },
}));

const reading = (at: number, hPa = 1000): PressureReading => ({ at, hPa });

describe('pressureAt', () => {
  const readings = [reading(1000, 1000), reading(2000, 999.9), reading(3000, 999.8)];

  it('takes the reading closest in time to the fix', () => {
    expect(pressureAt(readings, 1400)).toBe(1000);
    expect(pressureAt(readings, 1600)).toBe(999.9);
    expect(pressureAt(readings, 3000)).toBe(999.8);
  });

  it('also uses a reading that came just after the fix', () => {
    expect(pressureAt(readings, 0)).toBe(1000);
  });

  it(`gives no pressure when the closest reading is over ${MAX_PAIR_GAP_MS / 1000} s away`, () => {
    expect(pressureAt(readings, 3000 + MAX_PAIR_GAP_MS)).toBe(999.8);
    expect(pressureAt(readings, 3000 + MAX_PAIR_GAP_MS + 1)).toBeNull();
  });

  it('gives no pressure without readings (no barometer)', () => {
    expect(pressureAt([], 1000)).toBeNull();
  });
});

describe('addReading', () => {
  it('appends the reading', () => {
    expect(addReading([reading(1000)], reading(2000))).toEqual([reading(1000), reading(2000)]);
  });

  it(`forgets readings older than ${KEEP_READINGS_MS / 1000} s`, () => {
    const now = 500_000;
    const kept = addReading(
      [reading(now - KEEP_READINGS_MS - 1), reading(now - KEEP_READINGS_MS)],
      reading(now),
    );
    expect(kept).toEqual([reading(now - KEEP_READINGS_MS), reading(now)]);
  });
});

describe('isStale', () => {
  it(`is stale after ${STALE_AFTER_MS / 1000} s without a reading`, () => {
    expect(isStale(0, STALE_AFTER_MS)).toBe(false);
    expect(isStale(0, STALE_AFTER_MS + 1)).toBe(true);
  });
});

describe('reading the barometer', () => {
  // The module keeps its state (is it running, the readings) between calls,
  // so each test loads a fresh copy.
  let pressure: typeof import('../pressure');
  let barometer: jest.Mocked<typeof import('expo-sensors').Barometer>;
  let emit: (measurement: BarometerMeasurement) => void;
  let remove: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      pressure = jest.requireActual('../pressure');
      barometer = jest.requireMock<typeof import('expo-sensors')>('expo-sensors').Barometer as never;
    });
    barometer.isAvailableAsync.mockResolvedValue(true);
    remove = jest.fn();
    barometer.addListener.mockImplementation((listener) => {
      emit = listener;
      return { remove } as never;
    });
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => jest.restoreAllMocks());

  const now = (ms: number) => jest.spyOn(Date, 'now').mockReturnValue(ms);

  it('keeps readings, stamped with the time they arrived', async () => {
    await pressure.startPressureReadings();
    expect(barometer.setUpdateInterval).toHaveBeenCalledWith(1000);
    now(1_001_000);
    // The sensor's own timestamp (seconds since boot) is ignored.
    emit({ pressure: 1003.2, timestamp: 42 });
    expect(pressure.getPressureReadings()).toEqual([{ at: 1_001_000, hPa: 1003.2 }]);
  });

  it('starts only once', async () => {
    await Promise.all([pressure.startPressureReadings(), pressure.startPressureReadings()]);
    await pressure.startPressureReadings();
    expect(barometer.addListener).toHaveBeenCalledTimes(1);
  });

  it('does nothing on a phone without a barometer', async () => {
    barometer.isAvailableAsync.mockResolvedValue(false);
    await pressure.startPressureReadings();
    pressure.keepPressureReadingsAlive();
    expect(barometer.addListener).not.toHaveBeenCalled();
    expect(pressure.getPressureReadings()).toEqual([]);
  });

  it('never throws when the sensor fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    barometer.isAvailableAsync.mockRejectedValue(new Error('no sensor service'));
    await expect(pressure.startPressureReadings()).resolves.toBeUndefined();
  });

  it('stops listening and forgets the readings', async () => {
    await pressure.startPressureReadings();
    emit({ pressure: 1000, timestamp: 0 });
    pressure.stopPressureReadings();
    expect(remove).toHaveBeenCalled();
    expect(pressure.getPressureReadings()).toEqual([]);
  });

  it('starts the barometer from the background task if it is not running', async () => {
    pressure.keepPressureReadingsAlive();
    await Promise.resolve(); // let isAvailableAsync resolve
    await Promise.resolve();
    expect(barometer.addListener).toHaveBeenCalledTimes(1);
  });

  it('subscribes again when the sensor went quiet (Android paused it)', async () => {
    await pressure.startPressureReadings();
    emit({ pressure: 1000, timestamp: 0 });

    pressure.keepPressureReadingsAlive(1_000_000 + STALE_AFTER_MS);
    expect(barometer.addListener).toHaveBeenCalledTimes(1); // still fresh

    pressure.keepPressureReadingsAlive(1_000_000 + STALE_AFTER_MS + 1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(barometer.addListener).toHaveBeenCalledTimes(2);
    // Readings from before the pause are kept for fixes that arrive late.
    expect(pressure.getPressureReadings()).toHaveLength(1);
  });
});
