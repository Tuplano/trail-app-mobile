import { GoogleOneTapSignIn } from 'react-native-nitro-google-signin';

import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import { GOOGLE_WEB_CLIENT_ID } from '@/config/google';

import { useAuthStore } from '../auth-store';
import { signInWithGoogle } from '../google-sign-in';

// The library's real response helpers check `type`; the native calls are fakes.
jest.mock('react-native-nitro-google-signin', () => ({
  GoogleOneTapSignIn: {
    configure: jest.fn(async () => {}),
    checkPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    createAccount: jest.fn(),
    presentExplicitSignIn: jest.fn(),
  },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
  isNoSavedCredentialFoundResponse: (r: { type: string }) => r.type === 'noSavedCredentialFound',
  isCancelledResponse: (r: { type: string }) => r.type === 'cancelled',
}));
jest.mock('expo-device', () => ({ modelName: 'Pixel 9' }));
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock('@/api/client', () => ({ api: { POST: jest.fn() } }));

const google = jest.mocked(GoogleOneTapSignIn);
const post = jest.mocked(api.POST);

const success = { type: 'success', data: { idToken: 'google-id-token', user: { email: 'maya@gmail.com' } } };
const noSaved = { type: 'noSavedCredentialFound' };
const cancelled = { type: 'cancelled' };

const apiResult = {
  user: {
    id: '0190a3c4-0000-7000-8000-000000000001',
    email: 'maya@gmail.com',
    username: 'maya',
    displayName: 'Maya',
    avatarUrl: null,
    createdAt: '2026-11-20T00:00:00.000Z',
  },
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-11-20T00:15:00.000Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2026-12-20T00:00:00.000Z',
  isNewUser: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ status: 'signedOut', user: null, session: null });
  post.mockResolvedValue({ data: apiResult, error: undefined, response: new Response() } as never);
});

describe('signInWithGoogle', () => {
  it("sends Google's ID token to the API and signs in", async () => {
    google.signIn.mockResolvedValue(success as never);

    await expect(signInWithGoogle()).resolves.toBe(true);

    expect(google.configure).toHaveBeenCalledWith({ webClientId: GOOGLE_WEB_CLIENT_ID });
    expect(post).toHaveBeenCalledWith('/api/v1/auth/google', {
      body: { idToken: 'google-id-token', deviceName: 'Pixel 9' },
    });
    const state = useAuthStore.getState();
    expect(state.status).toBe('signedIn');
    expect(state.user?.username).toBe('maya');
    expect(state.session).not.toHaveProperty('isNewUser');
  });

  it("falls back to Google's account chooser, then its full sign-in screen", async () => {
    google.signIn.mockResolvedValue(noSaved as never);
    google.createAccount.mockResolvedValue(noSaved as never);
    google.presentExplicitSignIn.mockResolvedValue(success as never);

    await expect(signInWithGoogle()).resolves.toBe(true);
    expect(google.createAccount).toHaveBeenCalled();
    expect(google.presentExplicitSignIn).toHaveBeenCalled();
  });

  it('does nothing when the hiker closes Google sign-in', async () => {
    google.signIn.mockResolvedValue(cancelled as never);

    await expect(signInWithGoogle()).resolves.toBe(false);
    expect(post).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('stays signed out when the API refuses (email has a password account)', async () => {
    google.signIn.mockResolvedValue(success as never);
    post.mockResolvedValue({
      data: undefined,
      error: { error: { code: 'EMAIL_TAKEN', message: 'Sign in with your password.' } },
      response: new Response(null, { status: 409 }),
    } as never);

    const attempt = signInWithGoogle();
    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    expect(useAuthStore.getState().status).toBe('signedOut');
  });
});
