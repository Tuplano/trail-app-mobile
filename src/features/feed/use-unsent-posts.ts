import { useCallback, useState } from 'react';

import { getDb } from '@/db/database';
import { listUnsentPosts, type UnsentPost } from '@/db/posts';
import { useAuthStore } from '@/features/auth/auth-store';
import { useLoadWhileFocused } from '@/features/history/use-hikes';

/**
 * Your posts saved on this phone but not on the server yet, for the top of
 * the feed. Read again whenever uploads move, so a post leaves this list
 * (and appears in the server's feed) once it's uploaded.
 */
export function useUnsentPosts(): UnsentPost[] {
  const [posts, setPosts] = useState<UnsentPost[]>([]);
  const userId = useAuthStore((s) => s.user?.id);

  useLoadWhileFocused(
    useCallback(
      async (isLatest) => {
        if (!userId) return;
        const list = await listUnsentPosts(await getDb(), userId);
        if (isLatest()) setPosts(list);
      },
      [userId],
    ),
  );

  return posts;
}
