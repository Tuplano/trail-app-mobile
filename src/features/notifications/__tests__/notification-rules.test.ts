import { notificationAccess, notificationTarget } from '../notification-rules';

describe('notificationAccess', () => {
  it('is on once allowed', () => {
    expect(notificationAccess({ granted: true, canAskAgain: true })).toBe('on');
    expect(notificationAccess({ granted: true, canAskAgain: false })).toBe('on');
  });

  it('can ask while the hiker has not decided', () => {
    expect(notificationAccess({ granted: false, canAskAgain: true })).toBe('ask');
  });

  it("is off once refused: the phone won't show its prompt again", () => {
    expect(notificationAccess({ granted: false, canAskAgain: false })).toBe('off');
  });
});

describe('notificationTarget', () => {
  it('opens Profile for a badge, and says which notification to mark read', () => {
    expect(
      notificationTarget({
        type: 'achievement_unlocked',
        notificationId: '7f1c2d3e-0000-4000-8000-000000000001',
        code: 'hikes_10',
        hikeId: null,
      }),
    ).toEqual({ href: '/profile', notificationId: '7f1c2d3e-0000-4000-8000-000000000001' });
  });

  it('opens Profile for a new level', () => {
    expect(notificationTarget({ type: 'level_up', notificationId: 'n1', level: 8 })).toEqual({
      href: '/profile',
      notificationId: 'n1',
    });
  });

  it('still opens Profile when the id is missing', () => {
    expect(notificationTarget({ type: 'level_up', level: 8 })).toEqual({
      href: '/profile',
      notificationId: null,
    });
  });

  it("ignores kinds it doesn't know, and data that isn't the API's", () => {
    expect(notificationTarget({ type: 'weekly_digest', notificationId: 'n1' })).toBeNull();
    expect(notificationTarget({})).toBeNull();
    expect(notificationTarget(null)).toBeNull();
    expect(notificationTarget('achievement_unlocked')).toBeNull();
  });
});
