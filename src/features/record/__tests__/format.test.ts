import { formatClock, formatDuration, formatKm, formatMeters, formatPace } from '../format';

describe('formatDuration', () => {
  it('shows m:ss under an hour and h:mm:ss after', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59.9)).toBe('0:59');
    expect(formatDuration(754)).toBe('12:34');
    expect(formatDuration(4530)).toBe('1:15:30');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('formatKm and formatMeters', () => {
  it('rounds for display', () => {
    expect(formatKm(0)).toBe('0.00');
    expect(formatKm(1234.5)).toBe('1.23');
    expect(formatMeters(152.6)).toBe('153');
  });
});

describe('formatPace', () => {
  it('is minutes per km of moving time', () => {
    // 2 km in 25 minutes of moving → 12:30 per km.
    expect(formatPace(25 * 60, 2000)).toBe('12:30');
  });

  it('shows a dash until there is enough to measure', () => {
    expect(formatPace(60, 50)).toBe('–:––');
    expect(formatPace(0, 2000)).toBe('–:––');
  });
});

describe('formatClock', () => {
  it('always shows hours, like a stopwatch', () => {
    expect(formatClock(0)).toBe('0:00:00');
    expect(formatClock(59.9)).toBe('0:00:59');
    expect(formatClock(4530)).toBe('1:15:30');
    expect(formatClock(-3)).toBe('0:00:00');
  });
});
