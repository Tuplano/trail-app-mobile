import {
  keepPreviousData,
  type InfiniteData,
  type QueryFilters,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from '@tanstack/react-query';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { queryClient } from '@/api/query-client';
import type { components } from '@/api/schema';
import { FEED_QUERY_KEY, userPostsKey } from '@/features/feed/feed-api';
import type { FeedPage } from '@/features/feed/feed-cache';

import { type Person, type Profile, withFollowing, withProfileFollow } from './people-cache';

type FollowPage = components['schemas']['FollowListDto'];
export type FollowListKind = 'followers' | 'following';

const profileKey = (userId: string) => ['profile', userId] as const;
const followListKey = (userId: string, kind: FollowListKind) => ['follows', kind, userId] as const;
const searchKey = (q: string) => ['user-search', q] as const;

/** Lists of people with a follow button: search results, followers, following. */
const PEOPLE_LISTS: QueryFilters = {
  predicate: (query) => query.queryKey[0] === 'follows' || query.queryKey[0] === 'user-search',
};

/** Someone's profile header: name, counts, and whether you follow them. */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileKey(userId ?? ''),
    enabled: !!userId,
    queryFn: async (): Promise<Profile> => {
      const { data, error, response } = await api.GET('/api/v1/users/{id}', {
        params: { path: { id: userId! } },
      });
      if (!data) throw toApiError(error, response);
      return data;
    },
  });
}

/** Someone's posts you may see, newest first, a page at a time (the feed's shape). */
export function useUserPosts(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: userPostsKey(userId ?? ''),
    enabled: !!userId,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const { data, error, response } = await api.GET('/api/v1/users/{id}/posts', {
        params: { path: { id: userId! }, query: pageParam ? { cursor: pageParam } : {} },
      });
      if (!data) throw toApiError(error, response);
      return data;
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** Who follows someone, or who they follow, newest follow first, a page at a time. */
export function useFollowList(userId: string | undefined, kind: FollowListKind) {
  return useInfiniteQuery({
    queryKey: followListKey(userId ?? '', kind),
    enabled: !!userId,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<FollowPage> => {
      const params = {
        path: { id: userId! },
        query: pageParam ? { cursor: pageParam } : {},
      };
      const { data, error, response } =
        kind === 'followers'
          ? await api.GET('/api/v1/users/{id}/followers', { params })
          : await api.GET('/api/v1/users/{id}/following', { params });
      if (!data) throw toApiError(error, response);
      return data;
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

/**
 * People matching a search (name, or the start of a @username). Only asks
 * once there are 2 characters; keeps showing the last results while the
 * next ones load, so the list doesn't flash empty while typing.
 */
export function useUserSearch(q: string) {
  const text = q.trim();
  return useQuery({
    queryKey: searchKey(text),
    enabled: text.length >= 2,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Person[]> => {
      const { data, error, response } = await api.GET('/api/v1/users', {
        params: { query: { q: text } },
      });
      if (!data) throw toApiError(error, response);
      return data.items;
    },
  });
}

type PeopleData = Person[] | InfiniteData<FollowPage, unknown>;

/** A people list (search results or a follow list) with one person's follow state changed. */
function peopleWithFollowing(data: PeopleData, userId: string, following: boolean): PeopleData {
  if (Array.isArray(data)) return withFollowing(data, userId, following);
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: withFollowing(page.items, userId, following),
    })),
  };
}

/**
 * Follows or unfollows someone. Their button and follower count change at
 * once, in their profile and every list; if the request fails they go back.
 * Afterwards the feed reloads: their posts come in, or go.
 */
export function useToggleFollow() {
  return useMutation({
    mutationFn: async ({ userId, follow }: { userId: string; follow: boolean }) => {
      const params = { path: { id: userId } };
      const { error, response } = follow
        ? await api.PUT('/api/v1/users/{id}/follow', { params })
        : await api.DELETE('/api/v1/users/{id}/follow', { params });
      // 204 No Content: there is no body, so only the status says it worked.
      if (!response.ok) throw toApiError(error, response);
    },
    onMutate: async ({ userId, follow }) => {
      await queryClient.cancelQueries({ queryKey: profileKey(userId) });
      await queryClient.cancelQueries(PEOPLE_LISTS);
      const profile = queryClient.getQueryData<Profile>(profileKey(userId));
      const lists = queryClient.getQueriesData<PeopleData>(PEOPLE_LISTS);
      if (profile) queryClient.setQueryData(profileKey(userId), withProfileFollow(profile, follow));
      queryClient.setQueriesData<PeopleData>(PEOPLE_LISTS, (data) =>
        data ? peopleWithFollowing(data, userId, follow) : data,
      );
      return { profile, lists };
    },
    onError: (_error, { userId }, context) => {
      if (context?.profile) queryClient.setQueryData(profileKey(userId), context.profile);
      for (const [key, data] of context?.lists ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: async (_data, _error, { userId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKey(userId) }),
        // Your own following count changed too.
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY }),
      ]);
    },
  });
}
