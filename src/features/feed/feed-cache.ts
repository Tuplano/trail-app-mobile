import type { InfiniteData } from '@tanstack/react-query';

import type { components } from '@/api/schema';

export type FeedPage = components['schemas']['FeedDto'];
export type FeedPost = FeedPage['items'][number];
export type CommentPage = components['schemas']['CommentListDto'];
export type FeedComment = CommentPage['items'][number];

type Feed = InfiniteData<FeedPage, string | null>;

/** The feed with one post changed; every other post (and page) is kept as is. */
function updatePost(feed: Feed, postId: string, change: (post: FeedPost) => FeedPost): Feed {
  return {
    ...feed,
    pages: feed.pages.map((page) =>
      page.items.some((post) => post.id === postId)
        ? { ...page, items: page.items.map((post) => (post.id === postId ? change(post) : post)) }
        : page,
    ),
  };
}

/**
 * The feed after liking or unliking a post. Without `likeCount` (the guess
 * shown before the server answers) the count moves by one; with it, the
 * server's own count is used. Liking twice doesn't count twice.
 */
export function withLike(feed: Feed, postId: string, liked: boolean, likeCount?: number): Feed {
  return updatePost(feed, postId, (post) => ({
    ...post,
    likedByMe: liked,
    likeCount:
      likeCount ?? Math.max(0, post.likeCount + (liked === post.likedByMe ? 0 : liked ? 1 : -1)),
  }));
}

/** The feed after a new comment on a post: one more in its count. */
export function withOneMoreComment(feed: Feed, postId: string): Feed {
  return updatePost(feed, postId, (post) => ({ ...post, commentCount: post.commentCount + 1 }));
}

/** Whether any photo in the feed is still being resized on the server. */
export function hasProcessingPhotos(feed: { pages: FeedPage[] } | undefined): boolean {
  return feedPosts(feed).some((post) => post.photos.some((photo) => photo.status === 'pending'));
}

/** Every post in the feed, in order. A post that moved between pages shows once. */
export function feedPosts(feed: { pages: FeedPage[] } | undefined): FeedPost[] {
  const seen = new Set<string>();
  return (feed?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((post) => !seen.has(post.id) && seen.add(post.id));
}

/**
 * Your queued posts that the feed doesn't have yet. A post can reach the
 * server while the phone misses the reply (the signal drops): until the next
 * retry it's still queued on the phone, but the feed already has it. Showing
 * both would put it in the feed twice.
 */
export function unsentNotInFeed<T extends { id: string }>(
  unsent: readonly T[],
  feedIds: Iterable<string>,
): T[] {
  const inFeed = new Set(feedIds);
  return unsent.filter((post) => !inFeed.has(post.id));
}
