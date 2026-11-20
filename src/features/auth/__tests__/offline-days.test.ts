import { api } from '@/api/client';

import { useAuthStore } from '../auth-store';
import type { Session, User } from '../session-storage';

// #17: "Sign in once and stay signed in, even after days offline."

// An in-memory stand-in for the phone's keychain/keystore (survives restarts).
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

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const user: User = {
  id: '0190a3c4-0000-7000-8000-000000000001',
  email: 'maya@example.com',
  username: 'maya',
  displayName: 'Maya Okafor',
  avatarUrl: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  hasPassword: true,
  googleConnected: false,
};

/**
 * A fake API that follows the real one's rules (trail-app-api tokens.service):
 * access tokens last 15 minutes, refresh tokens 90 days; each refresh token
 * works once; presenting one that was already used ends the whole sign-in,
 * unless the token it was swapped for was never used (its reply was lost):
 * then that one is cancelled and a new pair issued.
 */
const server = {
  now: 0,
  online: true,
  /** The next refresh reaches the server, but its reply never reaches the phone. */
  loseNextRefreshReply: false,
  issued: 0,
  access: new Map<string, number>(), // token -> expires at
  refresh: new Map<
    string,
    { expiresAt: number; used: boolean; revoked: boolean; replaces: string | null }
  >(),

  issue(replaces: string | null = null): Session {
    const n = ++this.issued;
    this.access.set(`access-${n}`, this.now + 15 * MINUTE);
    this.refresh.set(`refresh-${n}`, {
      expiresAt: this.now + 90 * DAY,
      used: false,
      revoked: false,
      replaces,
    });
    return {
      accessToken: `access-${n}`,
      accessTokenExpiresAt: new Date(this.now + 15 * MINUTE).toISOString(),
      refreshToken: `refresh-${n}`,
      refreshTokenExpiresAt: new Date(this.now + 90 * DAY).toISOString(),
    };
  },

  reset() {
    this.now = 0;
    this.online = true;
    this.loseNextRefreshReply = false;
    this.issued = 0;
    this.access.clear();
    this.refresh.clear();
  },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const unauthorized = (code: string) => json(401, { error: { code, message: code } });

const fakeFetch = jest.fn(async (request: Request) => {
  if (!server.online) throw new TypeError('Network request failed');
  const path = new URL(request.url).pathname;

  if (path === '/api/v1/auth/refresh') {
    const { refreshToken } = (await request.json()) as { refreshToken: string };
    const token = server.refresh.get(refreshToken);
    if (!token || token.revoked || token.expiresAt <= server.now) {
      return unauthorized('INVALID_REFRESH_TOKEN');
    }
    let tokens: Session;
    if (token.used) {
      // Already swapped. Was its replacement ever used?
      const replacement = [...server.refresh.values()]
        .filter((t) => t.replaces === refreshToken)
        .at(-1);
      if (!replacement || replacement.used || replacement.revoked) {
        // Reuse of a rotated token: the real API ends the whole sign-in.
        for (const t of server.refresh.values()) t.revoked = true;
        return unauthorized('INVALID_REFRESH_TOKEN');
      }
      replacement.revoked = true; // its reply was lost: cancel it, issue again
      tokens = server.issue(refreshToken);
    } else {
      token.used = true;
      tokens = server.issue(refreshToken);
    }
    if (server.loseNextRefreshReply) {
      server.loseNextRefreshReply = false;
      throw new TypeError('Network request failed'); // signal lost on the way back
    }
    return json(200, tokens);
  }

  if (path === '/api/v1/me') {
    const bearer = request.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const expiresAt = server.access.get(bearer);
    if (expiresAt === undefined || expiresAt <= server.now) return unauthorized('ACCESS_TOKEN_EXPIRED');
    return json(200, user);
  }
  return json(404, { error: { code: 'NOT_FOUND', message: path } });
});

const initialState = useAuthStore.getState();

/** Closes and reopens the app: memory is gone, the keychain stays. */
async function restartApp() {
  useAuthStore.setState(initialState, true);
  await useAuthStore.getState().hydrate();
}

const status = () => useAuthStore.getState().status;

beforeEach(async () => {
  mockKeychain.clear();
  server.reset();
  globalThis.fetch = fakeFetch as unknown as typeof fetch;
  useAuthStore.setState(initialState, true);
  await useAuthStore.getState().signIn({ ...server.issue(), user });
});

describe('days offline', () => {
  it('stays signed in through days offline, app restarts included', async () => {
    server.online = false;
    for (let day = 1; day <= 5; day++) {
      server.now += DAY;
      await restartApp();
      expect(status()).toBe('signedIn');
      // Calls fail for lack of signal; that never signs anyone out.
      await expect(api.GET('/api/v1/me')).rejects.toThrow('Network request failed');
      expect(status()).toBe('signedIn');
    }
    expect(useAuthStore.getState().user?.username).toBe('maya');
  });

  it('picks up quietly when the signal is back: one refresh, then all calls work', async () => {
    server.online = false;
    server.now += 10 * DAY;
    await restartApp();

    server.online = true;
    const { data } = await api.GET('/api/v1/me');

    expect(data?.username).toBe('maya');
    expect(status()).toBe('signedIn');
    // The new refresh token is saved, so the next restart uses it.
    await restartApp();
    expect(useAuthStore.getState().session?.refreshToken).toBe('refresh-2');
    expect((await api.GET('/api/v1/me')).data?.username).toBe('maya');
  });

  it('stays signed in when the signal drops during the refresh itself', async () => {
    server.now += 3 * DAY;
    server.online = true;
    // The refresh never reaches the server (e.g. the request times out going out).
    server.online = false;
    await expect(api.GET('/api/v1/me')).rejects.toThrow();
    expect(status()).toBe('signedIn');

    server.online = true;
    expect((await api.GET('/api/v1/me')).data?.username).toBe('maya');
  });

  it("stays signed in when the refresh's reply is lost on the way back", async () => {
    server.now += 3 * DAY;
    // The server rotates the token, but the phone never hears the answer.
    server.loseNextRefreshReply = true;
    await api.GET('/api/v1/me');
    expect(status()).toBe('signedIn');

    // Later, with signal: the phone still holds the old refresh token.
    server.now += 1 * DAY;
    const { data } = await api.GET('/api/v1/me');
    expect(data?.username).toBe('maya');
    expect(status()).toBe('signedIn');
  });

  it('signs out when a stolen copy of an older token was used in between', async () => {
    server.now += DAY;
    const stolen = useAuthStore.getState().session!.refreshToken;
    await api.GET('/api/v1/me'); // the phone refreshes: refresh-1 -> refresh-2
    // A thief uses the older copy before the phone uses refresh-2.
    const thief = await fakeFetch(
      new Request('http://api/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: stolen }),
      }),
    );
    expect(thief.status).toBe(200);

    server.now += DAY;
    await api.GET('/api/v1/me'); // the phone's refresh-2 was never swapped: reuse
    expect(status()).toBe('signedOut');
  });

  it('signs out cleanly after more than 90 days offline (the sign-in has expired)', async () => {
    server.online = false;
    server.now += 91 * DAY;
    await restartApp();
    expect(status()).toBe('signedIn'); // still usable offline until the server says no

    server.online = true;
    const { response } = await api.GET('/api/v1/me');

    expect(response.status).toBe(401);
    expect(status()).toBe('signedOut');
    // Nothing of the session is left on the phone to retry with.
    await restartApp();
    expect(status()).toBe('signedOut');
  });
});
