import { router } from 'expo-router';

import { StatBox, StatRow } from '@/components/ui/stat-box';

import { formatCount } from './people-format';

/**
 * Posts, followers and following in three boxes, in the look of the
 * design's profile stats (HIKES / KM / CLIMB). Followers and following open
 * the list of those people.
 */
export function ProfileCounts({
  userId,
  posts,
  followers,
  following,
}: {
  userId: string;
  posts: number;
  followers: number;
  following: number;
}) {
  const openList = (kind: 'followers' | 'following') => () =>
    router.push({
      pathname: kind === 'followers' ? '/users/[id]/followers' : '/users/[id]/following',
      params: { id: userId },
    });

  return (
    <StatRow>
      <StatBox label="POSTS" value={formatCount(posts)} />
      <StatBox label="FOLLOWERS" value={formatCount(followers)} onPress={openList('followers')} />
      <StatBox label="FOLLOWING" value={formatCount(following)} onPress={openList('following')} />
    </StatRow>
  );
}
