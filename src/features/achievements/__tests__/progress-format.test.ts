import { medals } from '@/theme/tokens';

import {
  formatMetric,
  medalMaterial,
  romanNumeral,
  stepTitle,
  trackProgress,
} from '../progress-format';

const step = (name: string, threshold: number, xp = 0, title: string | null = null) => ({
  name,
  title,
  threshold,
  xp,
});

describe('formatMetric', () => {
  it('reads distance in km, with a decimal while short', () => {
    expect(formatMetric('distance', 0)).toBe('0 km');
    expect(formatMetric('distance', 6_280)).toBe('6.2 km');
    expect(formatMetric('distance', 63_007)).toBe('63 km');
    expect(formatMetric('distance', 4_000_000)).toBe('4,000 km');
  });

  it('reads climb in meters, and counts in hikes and weeks', () => {
    expect(formatMetric('climb', 5_361.7)).toBe('5,361 m');
    expect(formatMetric('hikes', 1)).toBe('1 hike');
    expect(formatMetric('hikes', 15)).toBe('15 hikes');
    expect(formatMetric('active_weeks', 1)).toBe('1 week');
    expect(formatMetric('active_weeks', 250)).toBe('250 weeks');
  });
});

describe('stepTitle', () => {
  it("adds a step's own title", () => {
    expect(stepTitle(step('Gold', 8_849, 100, 'Everest'))).toBe('Gold · Everest');
    expect(stepTitle(step('Silver', 2_500))).toBe('Silver');
  });
});

describe('trackProgress', () => {
  it('fills the bar from the step reached to the next', () => {
    expect(
      trackProgress({
        metric: 'distance',
        value: 63_007,
        current: step('Silver', 50_000),
        next: step('Gold', 150_000, 100),
      }),
    ).toEqual({
      rank: 'Silver',
      fraction: 13_007 / 100_000,
      amount: '63 / 150 km',
      toGo: '87 km to Gold',
      reward: '+100 XP',
    });
  });

  it('starts from nothing before the first rank', () => {
    expect(
      trackProgress({
        metric: 'hikes',
        value: 0,
        current: null,
        next: step('Bronze', 1, 25),
      }),
    ).toMatchObject({
      rank: 'No rank yet',
      fraction: 0,
      amount: '0 / 1 hike',
      toGo: '1 hike to Bronze',
    });
  });

  it('names a prestige step, and keeps the bar in bounds', () => {
    expect(
      trackProgress({
        metric: 'active_weeks',
        value: 400,
        current: step('Prestige II', 350, 500),
        next: step('Prestige III', 400, 500),
      }),
    ).toMatchObject({
      rank: 'Prestige II',
      fraction: 1,
      toGo: '0 weeks to Prestige III',
    });
  });
});

describe('romanNumeral', () => {
  it.each([
    [1, 'I'],
    [4, 'IV'],
    [9, 'IX'],
    [14, 'XIV'],
    [40, 'XL'],
  ])('%i is %s', (n, letters) => {
    expect(romanNumeral(n)).toBe(letters);
  });

  it('falls back to digits outside the numerals', () => {
    expect(romanNumeral(0)).toBe('0');
    expect(romanNumeral(4000)).toBe('4000');
  });
});

describe('medalMaterial', () => {
  it("gives each rank its finish, and nothing for no rank or one the app doesn't know", () => {
    expect(medalMaterial('gold')).toBe(medals.gold);
    expect(medalMaterial('mythic')).toBe(medals.mythic);
    expect(medalMaterial(null)).toBeNull();
    expect(medalMaterial('obsidian')).toBeNull();
  });
});
