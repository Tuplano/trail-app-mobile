import { useLocalSearchParams } from 'expo-router';

import { FollowList } from '@/features/people/follow-list';

/** Who follows someone (you included), from the FOLLOWERS box on a profile. */
export default function FollowersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FollowList userId={id} kind="followers" />;
}
