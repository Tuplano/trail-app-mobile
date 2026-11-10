import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { queryClient } from '@/api/query-client';
import { Button } from '@/components/ui/button';
import { UsersThree } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import type { UnsentPost } from '@/db/posts';
import { useAuthStore } from '@/features/auth/auth-store';
import { CommentsSheet, type CommentsFor } from '@/features/feed/comments-sheet';
import { FEED_QUERY_KEY, useFeed, useToggleLike } from '@/features/feed/feed-api';
import { feedPosts, type FeedPost } from '@/features/feed/feed-cache';
import { feedStats, formatTimeAgo } from '@/features/feed/feed-format';
import { type FeedTab, FeedTabs } from '@/features/feed/feed-tabs';
import { PostCard } from '@/features/feed/post-card';
import { useUnsentPosts } from '@/features/feed/use-unsent-posts';
import { hikeTitle } from '@/features/history/hike-summary';
import { useSettingsStore } from '@/features/settings/settings-store';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

type Row = { kind: 'unsent'; post: UnsentPost } | { kind: 'post'; post: FeedPost };

/**
 * The feed, as in the design: your posts and those of people you follow,
 * newest first, loading more near the bottom. Your posts not uploaded yet
 * sit on top, marked "Queued". Like with the heart; the speech bubble opens
 * the comments. Nearby comes later (the API has no nearby feed yet).
 */
export default function FeedScreen() {
  const colors = useColors();
  const [tab, setTab] = useState<FeedTab>('following');
  const [commentsFor, setCommentsFor] = useState<CommentsFor | null>(null);
  const feed = useFeed();
  const like = useToggleLike();
  const unsent = useUnsentPosts();
  const me = useAuthStore((s) => s.user);
  const online = useSyncStatusStore((s) => s.online) !== false;
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

  // "3h ago" counts from when the feed was loaded, so it doesn't change on every render.
  const loadedAt = feed.dataUpdatedAt;
  const rows: Row[] = [
    ...unsent.map((post) => ({ kind: 'unsent' as const, post })),
    ...feedPosts(feed.data).map((post) => ({ kind: 'post' as const, post })),
  ];

  /** Why your post isn't up yet, where the design says "Waiting for signal". */
  const waitingFor = (post: UnsentPost) => {
    if (post.syncStatus === 'failed') return "The server didn't accept it";
    if (!online) return 'Waiting for signal';
    if (photosOnWifiOnly && post.photoUris.length > 0) return 'Waiting for Wi-Fi';
    return 'Uploading…';
  };

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'unsent') {
      const { post } = item;
      return (
        <PostCard
          postId={post.id}
          author={{ name: me?.displayName ?? 'You', avatarUrl: me?.avatarUrl ?? null }}
          subtitle={`${hikeTitle(post.hike)} · ${waitingFor(post)}`}
          status={post.syncStatus === 'failed' ? 'failed' : 'queued'}
          photos={post.photoUris.map((uri) => ({ key: uri, uri }))}
          stats={feedStats(post.hike)}
          caption={post.caption}
        />
      );
    }
    const { post } = item;
    const title = hikeTitle({ title: post.hike.title, startedAt: Date.parse(post.hike.startedAt) });
    return (
      <PostCard
        postId={post.id}
        author={{ name: post.author.displayName, avatarUrl: post.author.avatarUrl }}
        subtitle={`${title} · ${formatTimeAgo(Date.parse(post.createdAt), loadedAt)}`}
        photos={[...post.photos]
          .sort((a, b) => a.position - b.position)
          .map((photo) => ({
            key: photo.id,
            uri: photo.status === 'ready' ? (photo.fullUrl ?? photo.thumbUrl) : null,
          }))}
        stats={feedStats(post.hike)}
        caption={post.caption}
        likes={{
          count: post.likeCount,
          liked: post.likedByMe,
          onPress: () => like.mutate({ postId: post.id, like: !post.likedByMe }),
        }}
        comments={{
          count: post.commentCount,
          onPress: () =>
            setCommentsFor({
              postId: post.id,
              count: post.commentCount,
              author: post.author.displayName,
              hike: title,
            }),
        }}
      />
    );
  };

  const header = (
    <View style={styles.header}>
      <Text variant="title" style={styles.title}>
        Feed
      </Text>
      <FeedTabs value={tab} onChange={setTab} />
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

/** A message card in the list's place: loading failed, nothing yet, or coming soon. */
function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  const colors = useColors();
  return (
    <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      <View style={[styles.noticeIcon, { backgroundColor: colors.tint }]}>
        <UsersThree size={26} color={colors.accentHi} />
      </View>
      <Text variant="subheading">{title}</Text>
      <Text color="muted" style={styles.noticeBody}>
        {body}
      </Text>
      {action && <Button label={action.label} variant="secondary" onPress={action.onPress} />}
    </View>
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
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  spinner: {
    marginVertical: 24,
  },
  notice: {
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginHorizontal: 22,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  noticeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  noticeBody: {
    textAlign: 'center',
  },
});
