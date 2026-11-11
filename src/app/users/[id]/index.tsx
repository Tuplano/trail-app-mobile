import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/errors';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { CommentsSheet, type CommentsFor } from '@/features/feed/comments-sheet';
import { feedPosts } from '@/features/feed/feed-cache';
import { FeedPostCard } from '@/features/feed/feed-post-card';
import { FollowButton } from '@/features/people/follow-button';
import { useProfile, useUserPosts } from '@/features/people/people-api';
import { followerLabel } from '@/features/people/people-cache';
import { ProfileCounts } from '@/features/people/profile-counts';
import { ProfileHeader } from '@/features/people/profile-header';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { useColors } from '@/theme/use-colors';

/**
 * Someone else's profile, opened from a post, a search or a follow list.
 * The design only has your own profile, so this reuses its pieces: the
 * header (with Follow where yours has the gear), count boxes like its stats,
 * then their posts as in the feed.
 */
export default function UserProfileScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfile(id);
  const posts = useUserPosts(id);
  const online = useSyncStatusStore((s) => s.online) !== false;
  const [commentsFor, setCommentsFor] = useState<CommentsFor | null>(null);

  const refresh = () => {
    void profile.refetch();
    void posts.refetch();
  };

  if (!profile.data) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        {profile.isError ? (
          profile.error instanceof ApiError && [400, 404].includes(profile.error.status) ? (
            <Notice title="Hiker not found" body="This account doesn't exist anymore." />
          ) : (
            <Notice
              title={online ? "Couldn't load this profile" : 'No signal'}
              body={
                online ? 'Tap below to try again.' : 'This profile loads when you’re back online.'
              }
              action={online ? { label: 'Try again', onPress: refresh } : undefined}
            />
          )
        ) : online ? (
          <ActivityIndicator color={colors.accent} style={styles.spinner} />
        ) : (
          <Notice title="No signal" body="This profile loads when you’re back online." />
        )}
      </View>
    );
  }

  const person = profile.data;
  const header = (
    <View style={styles.header}>
      <ProfileHeader
        name={person.displayName}
        avatarUrl={person.avatarUrl}
        subtitle={`@${person.username} · ${followerLabel(person.followerCount)}`}
        right={
          <FollowButton
            userId={person.id}
            name={person.displayName}
            following={person.isFollowing}
          />
        }
      />
      <ProfileCounts
        userId={person.id}
        posts={person.postCount}
        followers={person.followerCount}
        following={person.followingCount}
      />
      <Text variant="subheading" style={styles.section}>
        Posts
      </Text>
    </View>
  );

  const empty = posts.isPending ? (
    <ActivityIndicator color={colors.accent} style={styles.spinner} />
  ) : posts.isError ? (
    <Notice
      title="Couldn't load their posts"
      body="Pull down to try again."
      action={{ label: 'Try again', onPress: () => posts.refetch() }}
    />
  ) : (
    <Notice
      title="No posts yet"
      body={
        person.isFollowing
          ? 'Their shared hikes will show up here and in your feed.'
          : 'Nothing you can see yet. Some hikes may be for followers only.'
      }
    />
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <FlatList
        data={feedPosts(posts.data)}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <FeedPostCard
            post={item}
            loadedAt={posts.dataUpdatedAt}
            onOpenComments={setCommentsFor}
            linkAuthor={false}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          posts.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : undefined
        }
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={(profile.isRefetching || posts.isRefetching) && !posts.isFetchingNextPage}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      />
      {commentsFor && <CommentsSheet post={commentsFor} onClose={() => setCommentsFor(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  list: {
    gap: 16,
    paddingBottom: 24,
  },
  header: {
    gap: 20,
    paddingTop: 4,
    paddingHorizontal: 18,
  },
  section: {
    paddingHorizontal: 4,
  },
  spinner: {
    marginVertical: 24,
  },
});
