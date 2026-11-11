import { feedStats, formatTimeAgo, unsentPostNote } from '../feed-format';

/** Epoch ms for a local date and time, so tests pass in any time zone. */
const at = (year: number, month: number, day: number, hour = 9, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();

describe('formatTimeAgo', () => {
  const now = at(2026, 11, 10, 15, 0);

  it('says "Just now", then minutes, then hours today', () => {
    expect(formatTimeAgo(now - 20_000, now)).toBe('Just now');
    expect(formatTimeAgo(at(2026, 11, 10, 14, 48), now)).toBe('12m ago');
    expect(formatTimeAgo(at(2026, 11, 10, 12, 0), now)).toBe('3h ago');
    expect(formatTimeAgo(at(2026, 11, 10, 0, 30), now)).toBe('14h ago');
  });

  it('says "Yesterday" for yesterday, even if less than a day ago', () => {
    expect(formatTimeAgo(at(2026, 11, 9, 23, 0), now)).toBe('Yesterday');
    expect(formatTimeAgo(at(2026, 11, 9, 0, 5), now)).toBe('Yesterday');
  });

  it('gives the date for older posts, with the year only if not this year', () => {
    expect(formatTimeAgo(at(2026, 11, 3), now)).toBe('Tue, Nov 3');
    expect(formatTimeAgo(at(2025, 12, 31), now)).toBe('Wed, Dec 31, 2025');
  });
});

describe('feedStats', () => {
  it('formats distance, climb and moving time as in the design', () => {
    expect(feedStats({ distanceM: 14200, elevationGainM: 1020, movingTimeS: 17280 })).toEqual({
      distance: '14.20 km',
      climb: '1,020 m',
      time: '4h 48m',
    });
  });

  it("shows a dash for numbers the server hasn't worked out yet", () => {
    expect(feedStats({ distanceM: null, elevationGainM: null, movingTimeS: null })).toEqual({
      distance: '–',
      climb: '–',
      time: '–',
    });
  });
});

describe('unsentPostNote', () => {
  const queued = {
    syncStatus: 'pending' as const,
    photosToUpload: 2,
    failedTries: 0,
    online: true,
    unmetered: true,
    photosOnWifiOnly: true,
  };

  it('waits for signal offline, as in the design', () => {
    expect(unsentPostNote({ ...queued, online: false })).toBe('Waiting for signal');
  });

  it('waits for Wi-Fi only when off Wi-Fi with photos still to upload', () => {
    expect(unsentPostNote({ ...queued, unmetered: false })).toBe('Waiting for Wi-Fi');
    expect(unsentPostNote({ ...queued, unmetered: false, photosToUpload: 0 })).toBe(
      'Queued for upload',
    );
    expect(unsentPostNote({ ...queued, unmetered: false, photosOnWifiOnly: false })).toBe(
      'Queued for upload',
    );
  });

  it("doesn't blame Wi-Fi when an upload on Wi-Fi failed", () => {
    expect(unsentPostNote({ ...queued, failedTries: 2 })).toBe("Couldn't upload · trying again");
  });

  it('shows uploading, and a refused post', () => {
    expect(unsentPostNote({ ...queued, syncStatus: 'syncing' })).toBe('Uploading…');
    expect(unsentPostNote({ ...queued, syncStatus: 'failed' })).toBe("The server didn't accept it");
  });
});
