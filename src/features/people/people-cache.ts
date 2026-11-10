import type { components } from '@/api/schema';

export type Profile = components['schemas']['ProfileDto'];
export type Person = components['schemas']['FollowListDto']['items'][number];

/** A person in a list (search, followers, following) after following or unfollowing them. */
export function withFollowing<T extends { id: string; isFollowing: boolean }>(
  people: readonly T[],
  userId: string,
  following: boolean,
): T[] {
  return people.map((person) =>
    person.id === userId ? { ...person, isFollowing: following } : person,
  );
}

/**
 * Their profile after following or unfollowing them: the button flips and
 * their follower count moves by one. Pressing twice doesn't count twice.
 */
export function withProfileFollow(profile: Profile, following: boolean): Profile {
  if (profile.isFollowing === following) return profile;
  return {
    ...profile,
    isFollowing: following,
    followerCount: Math.max(0, profile.followerCount + (following ? 1 : -1)),
  };
}

/** "1 follower", "128 followers". */
export function followerLabel(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'follower' : 'followers'}`;
}
