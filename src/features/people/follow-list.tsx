import { ActivityIndicator, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/auth-store';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { useColors } from '@/theme/use-colors';

import { type FollowListKind, useFollowList } from './people-api';
import { PersonRow } from './person-row';

/**
 * Who follows someone, or who they follow: a title, then the people in one
 * rounded card like the design's Profile and Settings lists, loading more
 * near the bottom. Each has a follow button.
 */
export function FollowList({ userId, kind }: { userId: string; kind: FollowListKind }) {
  const colors = useColors();
  const list = useFollowList(userId, kind);
  const online = useSyncStatusStore((s) => s.online) !== false;
  const myId = useAuthStore((s) => s.user?.id);
  const people = list.data?.pages.flatMap((page) => page.items) ?? [];
  const title = kind === 'followers' ? 'Followers' : 'Following';

  const empty = list.isPending ? (
    online ? (
      <ActivityIndicator color={colors.accent} style={styles.spinner} />
    ) : (
      <Notice title="No signal" body="This list loads when you’re back online." />
    )
  ) : list.isError ? (
    <Notice
      title={online ? `Couldn't load ${title.toLowerCase()}` : 'No signal'}
      body={
        online ? 'Pull down or tap below to try again.' : 'This list loads when you’re back online.'
      }
      action={online ? { label: 'Try again', onPress: () => list.refetch() } : undefined}
    />
  ) : (
    <Notice
      title={kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
      body={emptyBody(kind, userId === myId)}
    />
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <FlatList
        data={people}
        keyExtractor={(person) => person.id}
        renderItem={({ item, index }) => (
          <PersonRow person={item} first={index === 0} last={index === people.length - 1} />
        )}
        ListHeaderComponent={
          <Text variant="title" style={styles.title}>
            {title}
          </Text>
        }
        ListEmptyComponent={empty}
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : undefined
        }
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => void list.refetch()}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      />
    </SafeAreaView>
  );
}

function emptyBody(kind: FollowListKind, mine: boolean): string {
  if (kind === 'followers') {
    return mine
      ? 'When hikers follow you, they show up here.'
      : 'People who follow them show up here.';
  }
  return mine
    ? 'Find hikers to follow with the search on the Feed.'
    : 'Hikers they follow show up here.';
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  list: {
    paddingBottom: 24,
  },
  title: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 16,
  },
  spinner: {
    marginVertical: 24,
  },
});
