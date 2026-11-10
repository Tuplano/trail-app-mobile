import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { getDb } from '@/db/database';
import { getHike, type Hike, type HistoryHike, listFinishedHikes } from '@/db/hikes';
import { getPostForHike } from '@/db/posts';
import { getTrackPath, type PathPoint } from '@/db/track-points';
import { type SyncSnapshot, useSyncStatusStore } from '@/sync/sync-status-store';

/** True when an upload run started or ended, or the counts moved: hikes' badges may have changed. */
function uploadsChanged(now: SyncSnapshot, before: SyncSnapshot): boolean {
  return (
    now.syncing !== before.syncing || now.waiting !== before.waiting || now.failed !== before.failed
  );
}

/**
 * Runs `load` when the screen comes into view, and again whenever uploads
 * move while it stays in view, so upload badges stay current. Nothing runs
 * while the screen is hidden behind another tab.
 *
 * Each run gets an `isLatest` check: a slow read that finishes after a newer
 * one (or after the screen was left) must not overwrite fresher data.
 */
function useLoadWhileFocused(
  load: (isLatest: () => boolean) => Promise<void>,
): void {
  useFocusEffect(
    useCallback(() => {
      let latest = 0;
      let focused = true;
      const run = () => {
        const id = ++latest;
        load(() => focused && id === latest).catch((error: unknown) =>
          console.warn('Could not read hikes from the phone', error),
        );
      };

      run();
      const unsubscribe = useSyncStatusStore.subscribe((now, before) => {
        if (uploadsChanged(now, before)) run();
      });
      return () => {
        focused = false;
        unsubscribe();
      };
    }, [load]),
  );
}

/**
 * The hike history: every finished hike on this phone, newest first.
 * `hikes` is null until the first read finishes.
 */
export function useHikeHistory(): { hikes: HistoryHike[] | null; failed: boolean } {
  const [hikes, setHikes] = useState<HistoryHike[] | null>(null);
  const [failed, setFailed] = useState(false);

  useLoadWhileFocused(
    useCallback(async (isLatest) => {
      try {
        const list = await listFinishedHikes(await getDb());
        if (!isLatest()) return;
        setHikes(list);
        setFailed(false);
      } catch (error) {
        if (isLatest()) setFailed(true);
        throw error;
      }
    }, []),
  );

  return { hikes, failed };
}

export type HikeDetail =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'failed' }
  | { state: 'ready'; hike: Hike; path: PathPoint[]; shared: boolean };

/**
 * One hike, its route, and whether it was shared as a post, from the phone.
 * The route is read once per hike: it can't change after the hike is
 * finished, and handing the map a new array would make it re-frame itself.
 * Later reads only refresh the hike (its upload badge) and the post.
 */
export function useHikeDetail(id: string | undefined): HikeDetail {
  const [detail, setDetail] = useState<HikeDetail>({ state: 'loading' });
  const loadedPath = useRef<{ id: string; path: PathPoint[] } | null>(null);

  useLoadWhileFocused(
    useCallback(
      async (isLatest) => {
        if (!id) {
          setDetail({ state: 'missing' });
          return;
        }
        try {
          const db = await getDb();
          const hike = await getHike(db, id);
          if (!isLatest()) return;
          if (!hike) {
            setDetail({ state: 'missing' });
            return;
          }
          const path =
            loadedPath.current?.id === id ? loadedPath.current.path : await getTrackPath(db, id);
          const post = await getPostForHike(db, id);
          if (!isLatest()) return;
          loadedPath.current = { id, path };
          setDetail({ state: 'ready', hike, path, shared: post !== null });
        } catch (error) {
          // Keep showing the hike if only a refresh failed.
          if (isLatest()) setDetail((d) => (d.state === 'ready' ? d : { state: 'failed' }));
          throw error;
        }
      },
      [id],
    ),
  );

  return detail;
}
