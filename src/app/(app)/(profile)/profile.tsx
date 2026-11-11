import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { errorMessage } from '@/api/errors';
import { queryClient } from '@/api/query-client';
import { GearSix } from '@/components/ui/icons';
import { StatBox, StatRow } from '@/components/ui/stat-box';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/auth-store';
import type { User } from '@/features/auth/session-storage';
import {
  MY_BADGES_KEY,
  MY_STATS_KEY,
  useMyBadges,
  useMyStats,
} from '@/features/achievements/achievements-api';
import { levelProgress, profileStats } from '@/features/achievements/achievements-format';
import { BadgeGrid } from '@/features/achievements/badge-grid';
import { LevelCard } from '@/features/achievements/level-card';
import { useProfile } from '@/features/people/people-api';
import { followerLabel } from '@/features/people/people-cache';
import { ProfileCounts } from '@/features/people/profile-counts';
import { ProfileHeader } from '@/features/people/profile-header';
import { useRefreshMe } from '@/features/profile/profile-api';
import { useColors } from '@/theme/use-colors';

export default function ProfileScreen() {
  // The saved copy, so the profile shows offline. useRefreshMe updates it.
  const user = useAuthStore((s) => s.user);
  const refresh = useRefreshMe();
  // Your counts (posts, followers, following) come from your public profile.
  const counts = useProfile(user?.id);
  const stats = useMyStats();
  const badges = useMyBadges();

  // The server updates xp and badges a little after a hike uploads: look
  // again whenever the tab comes into view, if the last look is old.
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({ queryKey: MY_STATS_KEY, stale: true });
      void queryClient.refetchQueries({ queryKey: MY_BADGES_KEY, stale: true });
    }, []),
  );

  // This screen only exists while signed in, and signing in always saves the user.
  if (!user) return null;

  return (
    <Screen edges={['top']} contentStyle={styles.page}>
      <MyProfileHeader user={user} followers={counts.data?.followerCount} />
      {stats.data ? (
        <>
          <LevelCard progress={levelProgress(stats.data)} />
          <StatRow>
            {profileStats(stats.data).map((stat) => (
              <StatBox key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </StatRow>
        </>
      ) : stats.isError ? (
        <Text variant="small" color="muted2">
          Your level and badges show when you’re back online.
        </Text>
      ) : null}
      {counts.data ? (
        <ProfileCounts
          userId={user.id}
          posts={counts.data.postCount}
          followers={counts.data.followerCount}
          following={counts.data.followingCount}
        />
      ) : null}
      {badges.data && badges.data.length > 0 ? <BadgeGrid badges={badges.data} /> : null}
      {refresh.error ? (
        <Text variant="small" color="muted2">
          Showing your saved profile. {errorMessage(refresh.error)}
        </Text>
      ) : null}
    </Screen>
  );
}

/**
 * Your header, as in the design: picture, name, "@maya · 128 followers" and
 * the gear (Settings; sign out lives there). Your email and join date sit
 * under it. The follower count needs signal; offline it shows the handle only.
 * Tapping your picture or name opens Edit profile.
 */
function MyProfileHeader({ user, followers }: { user: User; followers: number | undefined }) {
  const colors = useColors();
  const joined = new Date(user.createdAt).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <ProfileHeader
      name={user.displayName}
      avatarUrl={user.avatarUrl}
      onPress={() => router.push('/edit-profile')}
      pressLabel="Edit profile"
      subtitle={
        followers === undefined
          ? `@${user.username}`
          : `@${user.username} · ${followerLabel(followers)}`
      }
      right={
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => [
            styles.settings,
            { borderColor: colors.line, backgroundColor: pressed ? colors.hover : 'transparent' },
          ]}>
          <GearSix size={20} color={colors.text} />
        </Pressable>
      }>
      <Text variant="label" color="muted3" numberOfLines={1}>
        {user.email} · Joined {joined}
      </Text>
    </ProfileHeader>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 20,
  },
  settings: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
