import { badgeNewsFromPush, bonusXpLabel, unreadBadgeNews } from '../badge-news';

const badge = (id: string, code: string, createdAt: string, readAt: string | null = null) => ({
  id,
  type: 'achievement_unlocked',
  title: `Badge unlocked: ${code}`,
  body: `About ${code}`,
  data: { code, hikeId: 'h1' },
  readAt,
  createdAt,
});

describe('unreadBadgeNews', () => {
  it('lists unread unlocks oldest first, as they happened', () => {
    // The API lists newest first.
    const items = [
      badge('n2', 'distance_10km', '2026-11-11T06:00:02Z'),
      badge('n1', 'hikes_1', '2026-11-11T06:00:01Z'),
    ];
    expect(unreadBadgeNews(items)).toEqual([
      {
        notificationId: 'n1',
        code: 'hikes_1',
        title: 'Badge unlocked: hikes_1',
        body: 'About hikes_1',
      },
      {
        notificationId: 'n2',
        code: 'distance_10km',
        title: 'Badge unlocked: distance_10km',
        body: 'About distance_10km',
      },
    ]);
  });

  it('leaves out ones already shown, and new levels', () => {
    const items = [
      badge('n1', 'hikes_1', '2026-11-11T06:00:01Z', '2026-11-11T06:01:00Z'),
      {
        id: 'n2',
        type: 'level_up',
        title: 'You reached level 8!',
        body: 'Keep hiking to reach level 9.',
        data: { level: 8 },
        readAt: null,
        createdAt: '2026-11-11T06:00:03Z',
      },
    ];
    expect(unreadBadgeNews(items)).toEqual([]);
  });

  it('skips an unlock without a badge code', () => {
    expect(unreadBadgeNews([{ ...badge('n1', 'x', '2026-11-11T06:00:01Z'), data: {} }])).toEqual(
      [],
    );
  });
});

describe('badgeNewsFromPush', () => {
  it('reads the badge from a badge push', () => {
    expect(
      badgeNewsFromPush({
        title: 'Badge unlocked: Century',
        body: 'Hike 100 km in total.',
        data: { type: 'achievement_unlocked', notificationId: 'n1', code: 'distance_100km' },
      }),
    ).toEqual({
      notificationId: 'n1',
      code: 'distance_100km',
      title: 'Badge unlocked: Century',
      body: 'Hike 100 km in total.',
    });
  });

  it('is null for a level push, or one missing its ids', () => {
    expect(
      badgeNewsFromPush({ title: 'x', body: 'y', data: { type: 'level_up', level: 8 } }),
    ).toBeNull();
    expect(
      badgeNewsFromPush({ title: 'x', body: 'y', data: { type: 'achievement_unlocked' } }),
    ).toBeNull();
    expect(badgeNewsFromPush({ title: null, body: null })).toBeNull();
  });
});

describe('bonusXpLabel', () => {
  it('shows the bonus as in the design, nothing without one', () => {
    expect(bonusXpLabel(150)).toBe('+150 XP');
    expect(bonusXpLabel(1200)).toBe('+1,200 XP');
    expect(bonusXpLabel(0)).toBe('');
    expect(bonusXpLabel(undefined)).toBe('');
  });
});
