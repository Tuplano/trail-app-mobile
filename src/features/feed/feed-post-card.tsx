import { useAuthStore } from '@/features/auth/auth-store';
import { hikeTitle } from '@/features/history/hike-summary';
import { openProfile } from '@/features/people/open-profile';

import type { CommentsFor } from './comments-sheet';
import { useToggleLike } from './feed-api';
import type { FeedPost } from './feed-cache';
import { feedStats, formatTimeAgo } from './feed-format';
import { PostCard } from './post-card';

/**
 * A post from the server as a card: in the feed and on someone's profile.
 * The heart likes it, the speech bubble opens its comments, and the
 * author's name opens their profile (yours opens the Profile tab).
 */
export function FeedPostCard({
  post,
  loadedAt,
  onOpenComments,
  linkAuthor = true,
}: {
  post: FeedPost;
  /** When the list was loaded: "3h ago" counts from it, so it doesn't change on every render. */
  loadedAt: number;
  onOpenComments: (post: CommentsFor) => void;
  /** Off on the author's own profile, where the link would open the same page again. */
  linkAuthor?: boolean;
}) {
  const like = useToggleLike();
  const myId = useAuthStore((s) => s.user?.id);
  const title = hikeTitle({
    title: post.hike.title,
    startedAt: Date.parse(post.hike.startedAt),
  });

  return (
    <PostCard
      postId={post.id}
      author={{
        name: post.author.displayName,
        avatarUrl: post.author.avatarUrl,
      }}
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
          onOpenComments({
            postId: post.id,
            count: post.commentCount,
            author: post.author.displayName,
            hike: title,
          }),
      }}
      onAuthorPress={linkAuthor ? () => openProfile(post.author.id, myId) : undefined}
    />
  );
}
