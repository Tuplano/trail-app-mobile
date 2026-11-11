import {
  badgeCountLabel,
  badgeProgressLabel,
  levelProgress,
  profileStats,
} from '../achievements-format';

describe('levelProgress', () => {
  it('fills the bar within the level, as in the design', () => {
    // Level 7 starts at 2,100 xp, level 8 at 2,800.
    expect(levelProgress({ xp: 2548, level: 7, levelMinXp: 2100, nextLevelMinXp: 2800 })).toEqual({
      title: 'Level 7',
      xpLabel: '2,548 / 2,800 XP',
      fraction: 448 / 700,
      toGo: '252 XP to level 8',
    });
  });

  it('starts empty at level 1 with no xp', () => {
    expect(levelProgress({ xp: 0, level: 1, levelMinXp: 0, nextLevelMinXp: 100 })).toMatchObject({
      fraction: 0,
      toGo: '100 XP to level 2',
    });
  });

  it('is full at the top level, with nothing to go', () => {
    expect(
      levelProgress({ xp: 50_000, level: 30, levelMinXp: 43_500, nextLevelMinXp: null }),
    ).toEqual({ title: 'Level 30', xpLabel: '50,000 XP', fraction: 1, toGo: 'Top level reached' });
  });

  it("keeps the bar in bounds when the numbers don't line up", () => {
    // The levels table can be retuned on the server before the next recompute.
    expect(
      levelProgress({ xp: 900, level: 3, levelMinXp: 300, nextLevelMinXp: 600 }).fraction,
    ).toBe(1);
    expect(
      levelProgress({ xp: 200, level: 3, levelMinXp: 300, nextLevelMinXp: 600 }).fraction,
    ).toBe(0);
  });
});

describe('badgeProgressLabel', () => {
  const locked = { unlockedAt: null };

  it('counts hikes and weeks', () => {
    expect(badgeProgressLabel({ ...locked, type: 'hike_count', threshold: 50, progress: 14 })).toBe(
      '14/50',
    );
    expect(badgeProgressLabel({ ...locked, type: 'streak', threshold: 4, progress: 2 })).toBe(
      '2/4',
    );
  });

  it('shows distance in whole km, climbing in meters', () => {
    expect(
      badgeProgressLabel({
        ...locked,
        type: 'total_distance',
        threshold: 100_000,
        progress: 58_659,
      }),
    ).toBe('58/100');
    expect(
      badgeProgressLabel({
        ...locked,
        type: 'total_elevation',
        threshold: 20_000,
        progress: 4_210.6,
      }),
    ).toBe('4,210/20k');
    expect(
      badgeProgressLabel({
        ...locked,
        type: 'total_elevation',
        threshold: 20_000,
        progress: 11_621,
      }),
    ).toBe('11.6k/20k');
  });

  it('shows nothing once unlocked, or for a peak', () => {
    expect(
      badgeProgressLabel({
        type: 'hike_count',
        threshold: 1,
        progress: 14,
        unlockedAt: '2026-11-02T06:00:00Z',
      }),
    ).toBe('');
    expect(badgeProgressLabel({ ...locked, type: 'peak', threshold: null, progress: null })).toBe(
      '',
    );
  });

  it('never shows more than the goal', () => {
    // Progress can pass the threshold before the server's next recompute.
    expect(badgeProgressLabel({ ...locked, type: 'hike_count', threshold: 10, progress: 12 })).toBe(
      '10/10',
    );
  });
});

describe('badgeCountLabel', () => {
  it('counts the unlocked ones', () => {
    expect(
      badgeCountLabel([
        { unlockedAt: '2026-11-02T06:00:00Z' },
        { unlockedAt: null },
        { unlockedAt: null },
      ]),
    ).toBe('1 of 3');
  });
});

describe('profileStats', () => {
  it('shows hikes, whole km and meters climbed, as in the design', () => {
    expect(
      profileStats({ hikeCount: 34, totalDistanceM: 95_870, totalElevationGainM: 11_260.4 }),
    ).toEqual([
      { label: 'HIKES', value: '34' },
      { label: 'KM', value: '95' },
      { label: 'CLIMB · M', value: '11,260' },
    ]);
  });
});
