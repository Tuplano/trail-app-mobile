import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { queryClient } from '@/api/query-client';
import { MagnifyingGlass } from '@/components/ui/icons';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import type { UnsentPost } from '@/db/posts';
import { useAuthStore } from '@/features/auth/auth-store';
import { CommentsSheet, type CommentsFor } from '@/features/feed/comments-sheet';
import { FEED_QUERY_KEY, useFeed } from '@/features/feed/feed-api';
import { feedPosts, type FeedPost, unsentNotInFeed } from '@/features/feed/feed-cache';
import { FeedPostCard } from '@/features/feed/feed-post-card';
import { feedStats, unsentPostNote } from '@/features/feed/feed-format';
import { type FeedTab, FeedTabs } from '@/features/feed/feed-tabs';
import { PostCard } from '@/features/feed/post-card';
import { useUnsentPosts } from '@/features/feed/use-unsent-posts';
import { hikeTitle } from '@/features/history/hike-summary';
import { useSettingsStore } from '@/features/settings/settings-store';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { useColors } from '@/theme/use-colors';

type Row = { kind: 'unsent'; post: UnsentPost } | { kind: 'post'; post: FeedPost };

/**
 * The feed, as in the design: your posts and those of people you follow,
 * newest first, loading more near the bottom. Your posts not uploaded yet
 * sit on top, marked "Queued". Like with the heart; the speech bubble opens
 * the comments; a name opens that hiker's profile, and the magnifier finds
 * people to follow. Nearby comes later (the API has no nearby feed yet).
 */
export default function FeedScreen() {
  const colors = useColors();
  const [tab, setTab] = useState<FeedTab>('following');
  const [commentsFor, setCommentsFor] = useState<CommentsFor | null>(null);
  const feed = useFeed();
  const unsent = useUnsentPosts();
  const me = useAuthStore((s) => s.user);
  const online = useSyncStatusStore((s) => s.online) !== false;
  const unmetered = useSyncStatusStore((s) => s.unmetered);
  const photosOnWifiOnly = useSettingsStore((s) => s.settings.photosOnWifiOnly);

  // When an upload run ends, a post may have just reached the server: show it.
  useEffect(
    () =>
      useSyncStatusStore.subscribe((now, before) => {
        if (before.syncing && !now.syncing) {
          void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
        }
      }),
    [],
  );

  const posts = feedPosts(feed.data);
  // A queued post the server already has (its reply got lost) shows once, from the server.
  const queued = unsentNotInFeed(unsent, posts.map((post) => post.id));
  const rows: Row[] = [
    ...queued.map((post) => ({ kind: 'unsent' as const, post })),
    ...posts.map((post) => ({ kind: 'post' as const, post })),
  ];

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'unsent') {
      const { post } = item;
      const note = unsentPostNote({ ...post, online, unmetered, photosOnWifiOnly });
      return (
        <PostCard
          postId={post.id}
          author={{ name: me?.displayName ?? 'You', avatarUrl: me?.avatarUrl ?? null }}
          subtitle={`${hikeTitle(post.hike)} · ${note}`}
          status={post.syncStatus === 'failed' ? 'failed' : 'queued'}
          photos={post.photoUris.map((uri) => ({ key: uri, uri }))}
          stats={feedStats(post.hike)}
          caption={post.caption}
        />
      );
    }
    return (
      <FeedPostCard
        post={item.post}
        loadedAt={feed.dataUpdatedAt}
        onOpenComments={setCommentsFor}
      />
    );
  };

  const header = (
    <View style={styles.header}>
      <Text variant="title" style={styles.title}>
        Feed
      </Text>
      <View style={styles.headerRight}>
        <FeedTabs value={tab} onChange={setTab} />
        {/* Not in the design, which has no way to find people: a round button like Profile's gear. */}
        <Pressable
          onPress={() => router.push('/search')}
          accessibilityRole="button"
          accessibilityLabel="Find people"
          style={({ pressed }) => [
            styles.searchButton,
            { borderColor: colors.line, backgroundColor: pressed ? colors.hover : 'transparent' },
          ]}>
          <MagnifyingGlass size={19} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );

  const empty = feed.isPending ? (
    <ActivityIndicator color={colors.accent} style={styles.spinner} />
  ) : feed.isError ? (
    <Notice
      title={online ? "Couldn't load the feed" : 'No signal'}
      body={
        online ? 'Pull down or tap below to try again.' : 'The feed loads when you’re back online.'
      }
      action={online ? { label: 'Try again', onPress: () => feed.refetch() } : undefined}
    />
  ) : (
    <Notice
      title="No posts yet"
      body="Share a hike from History, and follow hikers to see theirs here."
    />
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      {tab === 'nearby' ? (
        <View style={styles.flex}>
          {header}
          <Notice
            title="Nearby is coming soon"
            body="Public hikes from trails around you will show up here."
          />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => `${row.kind}:${row.post.id}`}
          renderItem={renderRow}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <ActivityIndicator color={colors.accent} style={styles.spinner} />
            ) : undefined
          }
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => void feed.refetch()}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.surface}
            />
          }
        />
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  spinner: {
    marginVertical: 24,
  },
});
