import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { getDb } from '@/db/database';
import { countFailedHikes, resetFailedHikes, setSyncStatus } from '@/db/hikes';
import { countWaiting, enqueueUnsyncedHikes, getNextAttemptAt, makeAllDue } from '@/db/outbox';

import { processOutbox } from '../process-outbox';
import { isOnline, requestSync, retryHikeUpload, retryUploads, startSync } from '../sync';
import { INITIAL_SYNC_SNAPSHOT, useSyncStatusStore } from '../sync-status-store';

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));
jest.mock('@/db/database', () => ({ getDb: jest.fn(async () => ({})) }));
jest.mock('@/db/hikes', () => ({
  countFailedHikes: jest.fn(),
  resetFailedHikes: jest.fn(),
  setSyncStatus: jest.fn(),
}));
jest.mock('@/db/outbox', () => ({
  countWaiting: jest.fn(),
  enqueueUnsyncedHikes: jest.fn(),
  getNextAttemptAt: jest.fn(),
  makeAllDue: jest.fn(),
}));
jest.mock('../process-outbox', () => ({ processOutbox: jest.fn() }));
jest.mock('../upload-hike', () => ({ uploadHike: jest.fn() }));

const netState = jest.mocked(Network.getNetworkStateAsync);
const process = jest.mocked(processOutbox);
const nextAttempt = jest.mocked(getNextAttemptAt);
const waiting = jest.mocked(countWaiting);
const failedHikes = jest.mocked(countFailedHikes);
const online = { isConnected: true, isInternetReachable: true };
const offline = { isConnected: false, isInternetReachable: false };
const status = () => useSyncStatusStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  netState.mockResolvedValue(online);
  process.mockResolvedValue({ uploaded: 0, failed: 0, gaveUp: 0, skipped: 0 });
  nextAttempt.mockResolvedValue(null);
  waiting.mockResolvedValue({ waiting: 0, backingOff: 0 });
  failedHikes.mockResolvedValue(0);
  status().update(INITIAL_SYNC_SNAPSHOT);
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

describe('isOnline', () => {
  it('needs a connection with working internet', () => {
    expect(isOnline(online)).toBe(true);
    expect(isOnline(offline)).toBe(false);
    // Wi-Fi without internet (e.g. a hotel login page).
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
    // Unknown reachability: trust the connection; a failed upload is retried.
    expect(isOnline({ isConnected: true })).toBe(true);
  });
});

describe('requestSync', () => {
  it('works through the outbox when online', async () => {
    await requestSync();
    expect(getDb).toHaveBeenCalled();
    expect(process).toHaveBeenCalledTimes(1);
  });

  it('does nothing offline', async () => {
    netState.mockResolvedValue(offline);
    await requestSync();
    expect(process).not.toHaveBeenCalled();
  });

  it('runs one sync at a time, plus one more if asked meanwhile', async () => {
    let finishFirst: () => void = () => {};
    process.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = () => resolve({ uploaded: 0, failed: 0, gaveUp: 0, skipped: 0 });
        }),
    );

    const first = requestSync();
    const second = requestSync();
    const third = requestSync();
    expect(second).toBe(first); // joined the running sync
    expect(third).toBe(first);

    await new Promise((r) => setTimeout(r, 0));
    finishFirst();
    await first;

    expect(process).toHaveBeenCalledTimes(2); // the run + one catch-up run
  });

  it('keeps going after a failed run', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.mockRejectedValueOnce(new Error('database locked'));
    await requestSync();
    await requestSync();
    expect(process).toHaveBeenCalledTimes(2);
  });
});

describe('sync status', () => {
  it('shows uploading during a run, then the counts left afterwards', async () => {
    let seenDuringRun: unknown;
    process.mockImplementationOnce(async () => {
      seenDuringRun = { syncing: status().syncing, waiting: status().waiting };
      waiting.mockResolvedValue({ waiting: 0, backingOff: 0 }); // the run uploaded it
      return { uploaded: 1, failed: 0, gaveUp: 0, skipped: 0 };
    });
    waiting.mockResolvedValue({ waiting: 1, backingOff: 0 });

    await requestSync();

    expect(seenDuringRun).toEqual({ syncing: true, waiting: 1 });
    expect(status()).toMatchObject({ syncing: false, waiting: 0, online: true });
  });

  it('shows what is waiting while offline', async () => {
    netState.mockResolvedValue(offline);
    waiting.mockResolvedValue({ waiting: 2, backingOff: 0 });
    failedHikes.mockResolvedValue(1);

    await requestSync();

    expect(status()).toMatchObject({ online: false, waiting: 2, failed: 1, syncing: false });
  });
});

describe('retryUploads', () => {
  it('re-queues given-up hikes, cuts the backoff short, and syncs', async () => {
    await retryUploads();

    expect(resetFailedHikes).toHaveBeenCalled();
    expect(enqueueUnsyncedHikes).toHaveBeenCalled();
    expect(makeAllDue).toHaveBeenCalled();
    expect(process).toHaveBeenCalledTimes(1);
    // Reset before queuing, so the reset hikes are queued too.
    expect(jest.mocked(resetFailedHikes).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(enqueueUnsyncedHikes).mock.invocationCallOrder[0],
    );
  });
});

describe('retryHikeUpload', () => {
  it('re-queues just that hike and syncs', async () => {
    await retryHikeUpload('hike-1');

    expect(setSyncStatus).toHaveBeenCalledWith(expect.anything(), 'hike-1', 'pending');
    expect(resetFailedHikes).not.toHaveBeenCalled();
    expect(enqueueUnsyncedHikes).toHaveBeenCalled();
    expect(process).toHaveBeenCalledTimes(1);
    // Marked pending before queuing, or the queue would skip it as failed.
    expect(jest.mocked(setSyncStatus).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(enqueueUnsyncedHikes).mock.invocationCallOrder[0],
    );
  });
});

describe('startSync', () => {
  it('syncs at start, when the internet comes back, and on returning to the app', async () => {
    let onNetwork: (state: Network.NetworkState) => void = () => {};
    jest.mocked(Network.addNetworkStateListener).mockImplementation((listener) => {
      onNetwork = listener;
      return { remove: jest.fn() } as never;
    });
    let onApp: (state: string) => void = () => {};
    const appRemove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      onApp = listener as (state: string) => void;
      return { remove: appRemove } as never;
    });
    const settle = () => new Promise((r) => setTimeout(r, 0));

    const stop = startSync();
    await settle();
    expect(process).toHaveBeenCalledTimes(1); // at start

    onNetwork(offline);
    await settle();
    onNetwork(online); // back online
    await settle();
    expect(process).toHaveBeenCalledTimes(2);

    onNetwork(online); // still online: no extra sync
    await settle();
    expect(process).toHaveBeenCalledTimes(2);

    onApp('active');
    await settle();
    expect(process).toHaveBeenCalledTimes(3);

    stop();
    expect(appRemove).toHaveBeenCalled();
  });
});

describe('retry timer', () => {
  afterEach(() => jest.useRealTimers());

  it('wakes sync up when the next failed item is due to be retried', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    jest.mocked(Network.addNetworkStateListener).mockReturnValue({ remove: jest.fn() } as never);
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    nextAttempt.mockResolvedValueOnce(1_000_000 + 120_000).mockResolvedValue(null);

    const stop = startSync();
    await jest.advanceTimersByTimeAsync(0);
    expect(process).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(119_000);
    expect(process).toHaveBeenCalledTimes(1); // not yet
    await jest.advanceTimersByTimeAsync(1_000);
    expect(process).toHaveBeenCalledTimes(2); // retried on time

    stop();
  });

  it('stops waking up once sync is stopped', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    jest.mocked(Network.addNetworkStateListener).mockReturnValue({ remove: jest.fn() } as never);
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    nextAttempt.mockResolvedValue(1_000_000 + 60_000);

    const stop = startSync();
    await jest.advanceTimersByTimeAsync(0);
    stop();
    await jest.advanceTimersByTimeAsync(120_000);
    expect(process).toHaveBeenCalledTimes(1);
  });
});
