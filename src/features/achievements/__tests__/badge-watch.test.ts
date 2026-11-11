import { AppState, type AppStateStatus } from 'react-native';

import { api } from '@/api/client';
import { INITIAL_SYNC_SNAPSHOT, useSyncStatusStore } from '@/sync/sync-status-store';

import { checkBadgeNews } from '../badge-news-check';
import { useBadgeNewsStore } from '../badge-news-store';
import { watchForBadges } from '../badge-watch';

/*
 * Task #45: a hike that crosses a badge's threshold uploads, and the badge
 * is celebrated once the server has worked it out. The server does that a
 * little after the upload (a queued job), so the phone must look again after
 * the upload, not just once, and must announce the unlock exactly once.
 *
 * The phone side is real (the watch, the check, the queue). The server is a
 * fake that, like trail-app-api, lists the user's notifications and adds an
 * unread "achievement_unlocked" one when the hike's processing finishes.
 */

jest.mock('@/api/client', () => ({ api: { GET: jest.fn(), POST: jest.fn() } }));
jest.mock('@/api/query-client', () => ({ queryClient: { invalidateQueries: jest.fn() } }));

const FIRST_STEPS = {
  id: '01a1c960-0000-7000-8000-000000000001',
  type: 'achievement_unlocked',
  title: 'Badge unlocked: First Steps',
  body: 'Finish your first hike.',
  data: { code: 'hikes_1', hikeId: 'hike-1' },
  readAt: null,
  createdAt: '2026-11-11T07:00:10.000Z',
};

/** The fake server's notifications for this user, newest first. */
let serverNotifications: (typeof FIRST_STEPS)[];
/** Fires the phone's "app came to the front" event. */
let comeToFront: (state: AppStateStatus) => void;

const get = jest.mocked(api.GET);
const listed = () => get.mock.calls.length;
const queued = () => useBadgeNewsStore.getState().waiting.map((news) => news.code);

/** The hike reached the server; its badges are worked out `ms` later. */
function uploadHike(processingMs: number) {
  useSyncStatusStore.getState().update({ lastUploadAt: Date.now() });
  setTimeout(() => serverNotifications.unshift(FIRST_STEPS), processingMs);
}

const check = () => {
  checkBadgeNews().catch(() => {});
};

let stop: () => void;

beforeEach(() => {
  jest.useFakeTimers();
  serverNotifications = [];
  useSyncStatusStore.getState().update(INITIAL_SYNC_SNAPSHOT);
  useBadgeNewsStore.getState().reset();
  get.mockReset().mockImplementation(
    async () =>
      ({
        data: { items: [...serverNotifications], nextCursor: null, unreadCount: 0 },
        error: undefined,
        response: new Response(),
      }) as never,
  );
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    comeToFront = handler as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
  stop = watchForBadges(check);
});

afterEach(() => {
  stop();
  jest.useRealTimers();
});

it('finds the badge once the server has worked it out after the upload', async () => {
  await jest.advanceTimersByTimeAsync(0);
  expect(listed()).toBe(1); // the look on launch: nothing yet
  expect(queued()).toEqual([]);

  uploadHike(10_000);

  await jest.advanceTimersByTimeAsync(4_000);
  expect(listed()).toBe(2); // too early: the server is still working
  expect(queued()).toEqual([]);

  await jest.advanceTimersByTimeAsync(8_000); // 12 s after the upload
  expect(listed()).toBe(3);
  expect(queued()).toEqual(['hikes_1']);

  await jest.advanceTimersByTimeAsync(18_000); // 30 s: looks once more
  expect(listed()).toBe(4);
  expect(queued()).toEqual(['hikes_1']); // still announced once
});

it('catches a slow server the next time the app comes to the front', async () => {
  await jest.advanceTimersByTimeAsync(0);
  uploadHike(45_000); // longer than the last look after the upload

  await jest.advanceTimersByTimeAsync(60_000);
  expect(listed()).toBe(4); // launch + three looks after the upload
  expect(queued()).toEqual([]);

  comeToFront('active');
  await jest.advanceTimersByTimeAsync(0);
  expect(queued()).toEqual(['hikes_1']);
});

it("doesn't look again when sync changes without uploading anything", async () => {
  await jest.advanceTimersByTimeAsync(0);
  useSyncStatusStore.getState().update({ syncing: true, waiting: 1 });
  useSyncStatusStore.getState().update({ syncing: false });
  await jest.advanceTimersByTimeAsync(60_000);
  expect(listed()).toBe(1);
});

it('stops looking on sign out', async () => {
  await jest.advanceTimersByTimeAsync(0);
  uploadHike(10_000);
  stop();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(listed()).toBe(1);
});

it('keeps going when a look fails (no signal), and finds it on the next', async () => {
  await jest.advanceTimersByTimeAsync(0);
  uploadHike(2_000);
  get.mockRejectedValueOnce(new TypeError('Network request failed'));

  await jest.advanceTimersByTimeAsync(4_000);
  expect(queued()).toEqual([]);

  await jest.advanceTimersByTimeAsync(8_000);
  expect(queued()).toEqual(['hikes_1']);
});
