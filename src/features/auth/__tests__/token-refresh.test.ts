import { api } from '@/api/client';

import { useAuthStore } from '../auth-store';
import type { Session, User } from '../session-storage';

// An in-memory stand-in for the phone's keychain/keystore.
const mockKeychain = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: jest.fn(async (key: string) => mockKeychain.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockKeychain.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockKeychain.delete(key);
  }),
}));

const user: User = {
  id: '0190a3c4-0000-7000-8000-000000000001',
  email: 'maya@example.com',
  username: 'maya',
  displayName: 'Maya Okafor',
  avatarUrl: null,
  createdAt: '2026-11-01T00:00:00.000Z',
};

const tokens = (n: number): Session => ({
  accessToken: `access-${n}`,
  accessTokenExpiresAt: '2026-11-08T00:15:00.000Z',
  refreshToken: `refresh-${n}`,
  refreshTokenExpiresAt: '2026-12-08T00:00:00.000Z',
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const unauthorized = () =>
  json(401, { error: { code: 'UNAUTHORIZED', message: 'Access token expired' } });

/**
 * A fake API server. Only `validToken` is accepted on /me, and /auth/refresh
 * behaves however the test says.
 */
let validToken = 'access-1';
let refreshBehaviour: 'ok' | 'rejected' | 'offline' = 'ok';
const calls: string[] = [];

const fakeFetch = jest.fn(async (request: Request) => {
  const path = new URL(request.url).pathname;
  const auth = request.headers.get('Authorization');
  calls.push(`${path} ${auth ?? '-'}`);

  if (path === '/api/v1/auth/refresh') {
    if (refreshBehaviour === 'offline') throw new TypeError('Network request failed');
    if (refreshBehaviour === 'rejected') return unauthorized();
    validToken = 'access-2';
    return json(200, tokens(2));
  }
  if (path === '/api/v1/me') {
    return auth === `Bearer ${validToken}` ? json(200, user) : unauthorized();
  }
  return json(404, { error: { code: 'NOT_FOUND', message: path } });
});

const initialState = useAuthStore.getState();

beforeEach(async () => {
  mockKeychain.clear();
  calls.length = 0;
  validToken = 'access-1';
  refreshBehaviour = 'ok';
  globalThis.fetch = fakeFetch as unknown as typeof fetch;
  useAuthStore.setState(initialState, true);
  await useAuthStore.getState().signIn({ ...tokens(1), user });
});

describe('token refresh', () => {
  it('sends the access token with each request', async () => {
    const { data } = await api.GET('/api/v1/me');

    expect(data?.username).toBe('maya');
    expect(calls).toEqual(['/api/v1/me Bearer access-1']);
  });

  it('refreshes on a 401 and retries the request with the new token', async () => {
    validToken = 'access-2'; // the server no longer accepts access-1

    const { data } = await api.GET('/api/v1/me');

    expect(data?.username).toBe('maya');
    expect(calls).toEqual([
      '/api/v1/me Bearer access-1',
      '/api/v1/auth/refresh -', // auth routes never carry the access token
      '/api/v1/me Bearer access-2',
    ]);
    expect(useAuthStore.getState().session?.refreshToken).toBe('refresh-2');
  });

  it('refreshes only once when several requests fail together', async () => {
    validToken = 'access-2';

    const results = await Promise.all([
      api.GET('/api/v1/me'),
      api.GET('/api/v1/me'),
      api.GET('/api/v1/me'),
    ]);

    expect(results.every((r) => r.data?.username === 'maya')).toBe(true);
    expect(calls.filter((c) => c.startsWith('/api/v1/auth/refresh'))).toHaveLength(1);
  });

  it('signs out when the server rejects the refresh token', async () => {
    validToken = 'access-2';
    refreshBehaviour = 'rejected';

    const { data, response } = await api.GET('/api/v1/me');

    expect(data).toBeUndefined();
    expect(response.status).toBe(401);
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('stays signed in when the refresh fails because there is no connection', async () => {
    validToken = 'access-2';
    refreshBehaviour = 'offline';

    const { response } = await api.GET('/api/v1/me');

    expect(response.status).toBe(401);
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', session: tokens(1) });
  });
});
