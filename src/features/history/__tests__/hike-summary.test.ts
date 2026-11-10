import {
  describeUpload,
  formatClockTime,
  formatHikeDate,
  hikeDurationS,
  hikeTitle,
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

describe('formatHikeDate', () => {
  const now = at(2026, 11, 10, 18);

  it('says Today and Yesterday for recent hikes', () => {
    expect(formatHikeDate(at(2026, 11, 10, 6), now)).toBe('Today');
    expect(formatHikeDate(at(2026, 11, 9, 23, 59), now)).toBe('Yesterday');
    expect(formatHikeDate(at(2026, 11, 1), at(2026, 11, 2, 0, 1))).toBe('Yesterday');
  });

  it('shows weekday, day and month this year, and adds the year before that', () => {
    expect(formatHikeDate(at(2026, 11, 8), now)).toBe('Sun, 8 Nov');
    expect(formatHikeDate(at(2025, 3, 3), now)).toBe('Mon, 3 Mar 2025');
  });

  it('handles the turn of the year', () => {
    expect(formatHikeDate(at(2025, 12, 31), at(2026, 1, 1, 10))).toBe('Yesterday');
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

describe('hikeDurationS', () => {
  it('is start to finish, pauses included', () => {
    expect(hikeDurationS({ startedAt: 1_000, endedAt: 3_601_000 })).toBe(3600);
  });

  it('is zero without an end time', () => {
    expect(hikeDurationS({ startedAt: 1_000, endedAt: null })).toBe(0);
  });
});

describe('describeUpload', () => {
  it('has a label and tone for every upload state', () => {
    expect(describeUpload('pending')).toEqual({ label: 'Waiting to upload', tone: 'waiting' });
    expect(describeUpload('syncing')).toEqual({ label: 'Uploading…', tone: 'waiting' });
    expect(describeUpload('synced')).toEqual({ label: 'Uploaded', tone: 'done' });
    expect(describeUpload('failed')).toEqual({ label: "Couldn't upload", tone: 'problem' });
  });
});
