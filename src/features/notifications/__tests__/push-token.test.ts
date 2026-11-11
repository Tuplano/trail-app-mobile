import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { api } from '@/api/client';
import { useAuthStore } from '@/features/auth/auth-store';

import { askForNotifications, forgetPushToken, registerPushToken } from '../push-token';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: {} } }));
jest.mock('expo-secure-store', () => {
  const saved = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: 0,
    getItemAsync: jest.fn(async (key: string) => saved.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void saved.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void saved.delete(key)),
  };
});
jest.mock('@/api/client', () => ({ api: { POST: jest.fn(), DELETE: jest.fn() } }));

const TOKEN = 'ExponentPushToken[abc123]';
const TOKEN_ID = '5b0a3c1e-0000-4000-8000-000000000001';

const notifications = jest.mocked(Notifications);
const post = jest.mocked(api.POST);
const del = jest.mocked(api.DELETE);
const config = Constants as unknown as { expoConfig: { extra?: unknown } };

const permission = (granted: boolean, canAskAgain = true) =>
  ({ granted, canAskAgain, status: granted ? 'granted' : 'undetermined' }) as never;

function signInAs(id: string) {
  useAuthStore.setState({
    status: 'signedIn',
    user: { id } as never,
    session: { accessToken: `access-${id}` } as never,
  });
}

beforeEach(async () => {
  await forgetPushToken(undefined); // a fresh run: nothing registered or saved
  jest.clearAllMocks();
  config.expoConfig = { extra: { eas: { projectId: 'project-1' } } };
  notifications.getPermissionsAsync.mockResolvedValue(permission(true));
  notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: TOKEN });
  post.mockResolvedValue({
    data: { id: TOKEN_ID, platform: 'android' },
    error: undefined,
    response: new Response(),
  } as never);
  del.mockResolvedValue({ data: undefined, error: undefined, response: new Response() } as never);
  signInAs('user-1');
});

describe('registerPushToken', () => {
  it("sends the phone's token to the API once a run", async () => {
    await registerPushToken();
    await registerPushToken();

    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/api/v1/push-tokens', {
      body: { token: TOKEN, platform: 'ios' }, // jest-expo runs as iOS by default
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('push.tokenId', TOKEN_ID);
  });

  it('sends it once when asked twice at the same moment', async () => {
    await Promise.all([registerPushToken(), registerPushToken()]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("does nothing while notifications aren't allowed", async () => {
    notifications.getPermissionsAsync.mockResolvedValue(permission(false));
    await registerPushToken();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('does nothing when signed out', async () => {
    useAuthStore.setState({ status: 'signedOut', user: null, session: null });
    await registerPushToken();
    expect(post).not.toHaveBeenCalled();
  });

  it('skips the token until the app has an EAS project', async () => {
    config.expoConfig = {};
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await registerPushToken();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('tries again next time when the API was out of reach', async () => {
    post.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(registerPushToken()).rejects.toThrow('Network request failed');

    await registerPushToken();
    expect(post).toHaveBeenCalledTimes(2);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('push.tokenId', TOKEN_ID);
  });

  it('sends it again for the next person who signs in on this phone', async () => {
    await registerPushToken();
    signInAs('user-2');
    await registerPushToken();
    expect(post).toHaveBeenCalledTimes(2);
  });
});

describe('askForNotifications', () => {
  it('sends the token straight after the hiker allows it', async () => {
    notifications.requestPermissionsAsync.mockResolvedValue(permission(true));
    await expect(askForNotifications()).resolves.toBe('on');
    // Registration runs in the background; let it finish.
    await registerPushToken();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('reports a refusal and sends nothing', async () => {
    notifications.requestPermissionsAsync.mockResolvedValue(permission(false, false));
    notifications.getPermissionsAsync.mockResolvedValue(permission(false, false));
    await expect(askForNotifications()).resolves.toBe('off');
    await registerPushToken();
    expect(post).not.toHaveBeenCalled();
  });
});

describe('forgetPushToken', () => {
  it("removes this phone's token from the API with the session's last access token", async () => {
    await registerPushToken();
    await forgetPushToken('access-user-1');

    expect(del).toHaveBeenCalledWith('/api/v1/push-tokens/{id}', {
      params: { path: { id: TOKEN_ID } },
      headers: { Authorization: 'Bearer access-user-1' },
    });
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('push.tokenId');
  });

  it('has nothing to remove when the token was never sent', async () => {
    await forgetPushToken('access-user-1');
    expect(del).not.toHaveBeenCalled();
  });
});
