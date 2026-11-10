import { type QueryFilters, useInfiniteQuery, useMutation } from '@tanstack/react-query';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { queryClient } from '@/api/query-client';

import {
  type CommentPage,
  type FeedComment,
  type FeedPage,
  hasProcessingPhotos,
  withLike,
  withOneMoreComment,
} from './feed-cache';

export const FEED_QUERY_KEY = ['feed'] as const;
/** Someone's posts, for their profile: the same shape as the feed. */
export const userPostsKey = (userId: string) => ['user-posts', userId] as const;

/** Every list of posts on screen (the feed, profiles), so a like shows in all of them. */
const POST_LISTS: QueryFilters = {
  predicate: (query) => query.queryKey[0] === 'feed' || query.queryKey[0] === 'user-posts',
};
const commentsKey = (postId: string) => ['comments', postId] as const;

type Feed = Parameters<typeof withLike>[0];

/**
 * The feed (your posts and those of people you follow, newest first), a
 * page at a time: the screen asks for the next page near the bottom.
 */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: FEED_QUERY_KEY,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const { data, error, response } = await api.GET('/api/v1/feed', {
        params: { query: pageParam ? { cursor: pageParam } : {} },
      });
      if (!data) throw toApiError(error, response);
      return data;
    },
    getNextPageParam: (last) => last.nextCursor,
    // A photo being resized shows as "processing": look again until it's ready.
    refetchInterval: (query) => (hasProcessingPhotos(query.state.data) ? 5000 : false),
  });
}

/**
 * Likes or unlikes a post. The heart changes at once; if the request fails
 * it goes back, and on success it shows the server's count.
 */
export function useToggleLike() {
  return useMutation({
    mutationFn: async ({ postId, like }: { postId: string; like: boolean }) => {
      const params = { path: { id: postId } };
      const { data, error, response } = like
        ? await api.PUT('/api/v1/posts/{id}/like', { params })
        : await api.DELETE('/api/v1/posts/{id}/like', { params });
      if (!data) throw toApiError(error, response);
      return data;
    },
    onMutate: async ({ postId, like }) => {
      // A refetch landing now would overwrite the guess with old numbers.
      await queryClient.cancelQueries(POST_LISTS);
      const before = queryClient.getQueriesData<Feed>(POST_LISTS);
      queryClient.setQueriesData<Feed>(POST_LISTS, (feed) =>
        feed ? withLike(feed, postId, like) : feed,
      );
      return { before };
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.before ?? []) queryClient.setQueryData(key, data);
    },
    onSuccess: (state, { postId }) => {
      queryClient.setQueriesData<Feed>(POST_LISTS, (feed) =>
        feed ? withLike(feed, postId, state.liked, state.likeCount) : feed,
      );
    },
  });
}

/** A post's comments, oldest first, a page at a time. Only fetched while `enabled`. */
export function useComments(postId: string | null) {
  return useInfiniteQuery({
    queryKey: commentsKey(postId ?? ''),
    enabled: postId !== null,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<CommentPage> => {
      const { data, error, response } = await api.GET('/api/v1/posts/{id}/comments', {
        params: { path: { id: postId! }, query: pageParam ? { cursor: pageParam } : {} },
      });
      if (!data) throw toApiError(error, response);
      return data;
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

/**
 * Adds a comment, then shows it at the end of the list and counts it on the
 * post. The id is made on the phone: sending the same comment again (after a
 * timeout) with the same id doesn't post it twice.
 */
export function useAddComment(postId: string | null) {
  return useMutation({
    mutationFn: async (comment: { id: string; body: string }): Promise<FeedComment> => {
      const { data, error, response } = await api.POST('/api/v1/posts/{id}/comments', {
        params: { path: { id: postId! } },
        body: comment,
      });
      if (!data) throw toApiError(error, response);
      return data;
    },
    onSuccess: async () => {
      if (!postId) return;
      queryClient.setQueriesData<Feed>(POST_LISTS, (feed) =>
        feed ? withOneMoreComment(feed, postId) : feed,
      );
      // The new comment is last; reloading the pages puts it where the server has it.
      await queryClient.invalidateQueries({ queryKey: commentsKey(postId) });
    },
  });
}
