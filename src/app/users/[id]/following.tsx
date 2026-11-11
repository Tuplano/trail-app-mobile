import { useLocalSearchParams } from 'expo-router';

import { FollowList } from '@/features/people/follow-list';

/** Who someone follows (you included), from the FOLLOWING box on a profile. */
export default function FollowingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FollowList userId={id} kind="following" />;
}
