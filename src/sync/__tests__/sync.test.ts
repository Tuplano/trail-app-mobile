import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { getDb } from '@/db/database';

import { processOutbox } from '../process-outbox';
import { isOnline, requestSync, startSync } from '../sync';

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));
jest.mock('@/db/database', () => ({ getDb: jest.fn(async () => ({})) }));
jest.mock('../process-outbox', () => ({ processOutbox: jest.fn() }));

const netState = jest.mocked(Network.getNetworkStateAsync);
const process = jest.mocked(processOutbox);
const online = { isConnected: true, isInternetReachable: true };
const offline = { isConnected: false, isInternetReachable: false };

beforeEach(() => {
  jest.clearAllMocks();
  netState.mockResolvedValue(online);
  process.mockResolvedValue({ uploaded: 0, failed: 0, skipped: 0 });
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
          finishFirst = () => resolve({ uploaded: 0, failed: 0, skipped: 0 });
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
