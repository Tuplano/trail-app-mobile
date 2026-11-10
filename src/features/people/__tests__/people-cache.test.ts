import { followerLabel, type Profile, withFollowing, withProfileFollow } from '../people-cache';

const profile = (followerCount: number, isFollowing: boolean): Profile => ({
  id: 'u1',
  username: 'maya',
  displayName: 'Maya Okafor',
  avatarUrl: null,
  followerCount,
  followingCount: 3,
  postCount: 2,
  isFollowing,
});

describe('withProfileFollow', () => {
  it('flips the button and counts one more follower', () => {
    expect(withProfileFollow(profile(127, false), true)).toMatchObject({
      isFollowing: true,
      followerCount: 128,
    });
  });

  it('counts one less when unfollowing, never below zero', () => {
    expect(withProfileFollow(profile(128, true), false).followerCount).toBe(127);
    expect(withProfileFollow(profile(0, true), false).followerCount).toBe(0);
  });

  it("doesn't count twice when nothing changes", () => {
    const already = profile(128, true);
    expect(withProfileFollow(already, true)).toBe(already);
  });
});

describe('withFollowing', () => {
  it('changes only that person in a list', () => {
    const people = [
      { id: 'a', isFollowing: false },
      { id: 'b', isFollowing: false },
    ];
    expect(withFollowing(people, 'b', true)).toEqual([
      { id: 'a', isFollowing: false },
      { id: 'b', isFollowing: true },
    ]);
  });
});

describe('followerLabel', () => {
  it('says follower or followers, with thousands separated', () => {
    expect(followerLabel(1)).toBe('1 follower');
    expect(followerLabel(0)).toBe('0 followers');
    expect(followerLabel(1280)).toBe('1,280 followers');
  });
});
