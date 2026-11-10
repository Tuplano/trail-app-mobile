import {
  describeHikeSync,
  describeOutbox,
  formatClockTime,
  formatCount,
  formatHikeDate,
  formatHikeDuration,
  hikeTitle,
  summarizeHistory,
} from '../hike-summary';

/** Epoch ms for a local date and time, so tests pass in any time zone. */
const at = (year: number, month: number, day: number, hour = 9, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();

describe('hikeTitle', () => {
  it('uses the title when the hike has one', () => {
    expect(hikeTitle({ title: ' Mt. Pulag ', startedAt: at(2026, 11, 10) })).toBe('Mt. Pulag');
  });

  it('names untitled hikes after the time of day they started', () => {
    const named = (hour: number) => hikeTitle({ title: null, startedAt: at(2026, 11, 10, hour) });
    expect(named(5)).toBe('Morning hike');
    expect(named(11)).toBe('Morning hike');
    expect(named(12)).toBe('Afternoon hike');
    expect(named(17)).toBe('Evening hike');
    expect(named(21)).toBe('Night hike');
    expect(named(3)).toBe('Night hike');
  });

  it('treats a blank title as no title', () => {
    expect(hikeTitle({ title: '  ', startedAt: at(2026, 11, 10, 8) })).toBe('Morning hike');
  });
});

describe('formatClockTime', () => {
  it('uses a 12-hour clock', () => {
    expect(formatClockTime(at(2026, 11, 10, 0, 5))).toBe('12:05 AM');
    expect(formatClockTime(at(2026, 11, 10, 8, 5))).toBe('8:05 AM');
    expect(formatClockTime(at(2026, 11, 10, 12, 30))).toBe('12:30 PM');
    expect(formatClockTime(at(2026, 11, 10, 23, 59))).toBe('11:59 PM');
  });
});

describe('formatHikeDate', () => {
  const now = at(2026, 11, 10, 18);

  it('says Today and Yesterday for recent hikes, with the start time', () => {
    expect(formatHikeDate(at(2026, 11, 10, 14, 14), now)).toBe('Today · 2:14 PM');
    expect(formatHikeDate(at(2026, 11, 9, 23, 59), now)).toBe('Yesterday · 11:59 PM');
    expect(formatHikeDate(at(2026, 11, 1), at(2026, 11, 2, 0, 1))).toBe('Yesterday · 9:00 AM');
  });

  it('shows weekday, month and day this year, and adds the year before that', () => {
    expect(formatHikeDate(at(2026, 11, 6, 7, 12), now)).toBe('Fri, Nov 6 · 7:12 AM');
    expect(formatHikeDate(at(2025, 3, 3), now)).toBe('Mon, Mar 3, 2025 · 9:00 AM');
  });

  it('handles the turn of the year', () => {
    expect(formatHikeDate(at(2025, 12, 31), at(2026, 1, 1, 10))).toBe('Yesterday · 9:00 AM');
  });
});

describe('formatHikeDuration', () => {
  it('shows hours and minutes, or just minutes under an hour', () => {
    expect(formatHikeDuration(4 * 3600 + 12 * 60)).toBe('4h 12m');
    expect(formatHikeDuration(36 * 60 + 20)).toBe('36m');
    expect(formatHikeDuration(0)).toBe('0m');
  });

  it('rounds to the minute before splitting into hours', () => {
    expect(formatHikeDuration(59 * 60 + 40)).toBe('1h 0m');
    expect(formatHikeDuration(3600 + 29)).toBe('1h 0m');
    expect(formatHikeDuration(3600 + 31)).toBe('1h 1m');
  });
});

describe('formatCount', () => {
  it('adds thousands separators', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1488)).toBe('1,488');
    expect(formatCount(1234567)).toBe('1,234,567');
  });
});

describe('summarizeHistory', () => {
  it('counts hikes and adds up their distance', () => {
    expect(summarizeHistory([{ distanceM: 12400 }, { distanceM: 5100 }])).toBe('2 hikes · 17.50 km');
    expect(summarizeHistory([{ distanceM: 60 }])).toBe('1 hike · 0.06 km');
  });
});

describe('describeHikeSync', () => {
  const hike = (syncStatus: 'pending' | 'syncing' | 'synced' | 'failed', pointCount = 1488) => ({
    id: 'hike-1',
    syncStatus,
    pointCount,
  });

  it('says a pending hike is queued, or saved on the phone while offline', () => {
    expect(describeHikeSync(hike('pending'), true)).toEqual({
      chip: 'pending',
      note: 'Queued for upload',
      problem: false,
      canRetry: false,
    });
    expect(describeHikeSync(hike('pending'), null).note).toBe('Queued for upload');
    expect(describeHikeSync(hike('pending'), false).note).toBe(
      'Saved on phone · uploads when online',
    );
  });

  it('shows an upload in progress', () => {
    expect(describeHikeSync(hike('syncing'), true)).toMatchObject({
      chip: 'uploading',
      note: 'Uploading points…',
    });
  });

  it('counts the points sent so far, as in the design', () => {
    const progress = { hikeId: 'hike-1', sent: 600, total: 1488 };
    expect(describeHikeSync(hike('syncing'), true, progress).note).toBe(
      'Uploading points 600 / 1,488',
    );
    // Another hike's upload says nothing about this one.
    const other = { ...progress, hikeId: 'hike-2' };
    expect(describeHikeSync(hike('syncing'), true, other).note).toBe('Uploading points…');
    expect(describeHikeSync(hike('pending'), true, other).chip).toBe('pending');
  });

  it('shows a pending hike as uploading once its upload has started', () => {
    const progress = { hikeId: 'hike-1', sent: 0, total: 1488 };
    expect(describeHikeSync(hike('pending'), true, progress)).toMatchObject({
      chip: 'uploading',
      note: 'Uploading points 0 / 1,488',
    });
    // A finished upload's progress doesn't change a synced or failed hike.
    expect(describeHikeSync(hike('synced'), true, progress).chip).toBe('synced');
    expect(describeHikeSync(hike('failed'), true, progress).chip).toBe('failed');
  });

  it('counts the track points of an uploaded hike', () => {
    expect(describeHikeSync(hike('synced'), true)).toMatchObject({
      chip: 'synced',
      note: '1,488 track points',
      problem: false,
    });
    expect(describeHikeSync(hike('synced', 1), true).note).toBe('1 track point');
  });

  it('offers Retry for a failed hike, except offline', () => {
    expect(describeHikeSync(hike('failed'), true)).toEqual({
      chip: 'failed',
      note: "The server didn't accept it · still saved on this phone",
      problem: true,
      canRetry: true,
    });
    expect(describeHikeSync(hike('failed'), false).canRetry).toBe(false);
  });
});

describe('describeOutbox', () => {
  it('is hidden when nothing waits to upload', () => {
    expect(describeOutbox({ waiting: 0, syncing: true, online: true })).toBeNull();
  });

  it('says hikes wait for signal while offline', () => {
    expect(describeOutbox({ waiting: 2, syncing: false, online: false })).toEqual({
      icon: 'offline',
      label: '2 waiting for signal · will upload automatically',
    });
  });

  it('shows a sync in progress, then what is left in the outbox', () => {
    expect(describeOutbox({ waiting: 1, syncing: true, online: true })).toEqual({
      icon: 'syncing',
      label: 'Syncing 1 hike…',
    });
    expect(describeOutbox({ waiting: 3, syncing: true, online: true })?.label).toBe(
      'Syncing 3 hikes…',
    );
    expect(describeOutbox({ waiting: 3, syncing: false, online: true })).toEqual({
      icon: 'queued',
      label: '3 in outbox',
    });
  });
});
