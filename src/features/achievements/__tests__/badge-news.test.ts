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
        kind: 'badge',
        code: 'hikes_1',
        title: 'Badge unlocked: hikes_1',
        body: 'About hikes_1',
        rank: null,
        step: 0,
        prestige: 0,
      },
      {
        notificationId: 'n2',
        kind: 'badge',
        code: 'distance_10km',
        title: 'Badge unlocked: distance_10km',
        body: 'About distance_10km',
        rank: null,
        step: 0,
        prestige: 0,
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

  it('lists new ranks with badges, in order', () => {
    const rank = {
      id: 'n3',
      type: 'rank_up',
      title: 'Climb: Gold',
      body: '8,849 m climbed over all your hikes.',
      data: { track: 'climb', step: 3, rank: 'gold', prestige: 0, hikeId: 'h1' },
      readAt: null,
      createdAt: '2026-11-11T06:00:00Z',
    };
    const news = unreadBadgeNews([badge('n1', 'climb_500m', '2026-11-11T06:00:01Z'), rank]);
    expect(news.map((n) => [n.kind, n.code, n.rank, n.step])).toEqual([
      ['rank', 'climb', 'gold', 3],
      ['badge', 'climb_500m', null, 0],
    ]);
  });

  it('keeps the order they were made in when they share a time', () => {
    const at = '2026-11-11T06:00:00Z';
    const rank = {
      id: '01a2-0001',
      type: 'rank_up',
      title: 'Distance: Gold',
      body: '150 km walked over all your hikes.',
      data: { track: 'distance', step: 3, rank: 'gold', prestige: 0 },
      readAt: null,
      createdAt: at,
    };
    // The API lists newest first: the badge, made second, comes first.
    const news = unreadBadgeNews([badge('01a2-0002', 'climb_500m', at), rank]);
    expect(news.map((n) => n.code)).toEqual(['distance', 'climb_500m']);
  });

  it('skips a rank without its track', () => {
    const noTrack = { ...badge('n1', 'x', '2026-11-11T06:00:01Z'), type: 'rank_up', data: {} };
    expect(unreadBadgeNews([noTrack])).toEqual([]);
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
      kind: 'badge',
      code: 'distance_100km',
      title: 'Badge unlocked: Century',
      body: 'Hike 100 km in total.',
      rank: null,
      step: 0,
      prestige: 0,
    });
  });

  it('reads a new rank from a rank push', () => {
    expect(
      badgeNewsFromPush({
        title: 'Distance: Prestige II',
        body: '6,000 km walked over all your hikes.',
        data: {
          type: 'rank_up',
          notificationId: 'n2',
          track: 'distance',
          step: 11,
          rank: 'mythic',
          prestige: 2,
          hikeId: 'h1',
        },
      }),
    ).toEqual({
      notificationId: 'n2',
      kind: 'rank',
      code: 'distance',
      title: 'Distance: Prestige II',
      body: '6,000 km walked over all your hikes.',
      rank: 'mythic',
      step: 11,
      prestige: 2,
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
