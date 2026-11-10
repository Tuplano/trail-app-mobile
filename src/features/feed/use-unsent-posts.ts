import { useCallback, useState } from 'react';

import { getDb } from '@/db/database';
import { listUnsentPosts, type UnsentPost } from '@/db/posts';
import { useLoadWhileFocused } from '@/features/history/use-hikes';

/**
 * Your posts saved on this phone but not on the server yet, for the top of
 * the feed. Read again whenever uploads move, so a post leaves this list
 * (and appears in the server's feed) once it's uploaded.
 */
export function useUnsentPosts(): UnsentPost[] {
  const [posts, setPosts] = useState<UnsentPost[]>([]);

  useLoadWhileFocused(
    useCallback(async (isLatest) => {
      const list = await listUnsentPosts(await getDb());
      if (isLatest()) setPosts(list);
    }, []),
  );

  return posts;
}
