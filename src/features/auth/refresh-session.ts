import createClient from 'openapi-fetch';

import type { paths } from '@/api/schema';
import { env } from '@/config/env';

import { useAuthStore } from './auth-store';

/** No auth middleware here, so a failing refresh can never trigger another refresh. */
const authClient = createClient<paths>({
  baseUrl: env.apiUrl,
  fetch: (request) => globalThis.fetch(request),
});

/**
 * refreshed:   new tokens are saved
 * signedOut:   the server rejected the refresh token, so the session is gone
 * unavailable: offline or the server is struggling; keep the session and try later
 */
export type RefreshResult = 'refreshed' | 'signedOut' | 'unavailable';

let inFlight: Promise<RefreshResult> | null = null;

/**
 * Trades the refresh token for new tokens. Refresh tokens work once, so
 * concurrent callers share one request instead of racing each other.
 */
export function refreshSession(): Promise<RefreshResult> {
  inFlight ??= runRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runRefresh(): Promise<RefreshResult> {
  const { session, setTokens, clear } = useAuthStore.getState();
  if (!session) return 'signedOut';

  let result;
  try {
    result = await authClient.POST('/api/v1/auth/refresh', {
      body: { refreshToken: session.refreshToken },
    });
  } catch {
    // No connection. Staying signed in while offline is the whole point.
    return 'unavailable';
  }

  if (result.data) {
    await setTokens(result.data);
    return 'refreshed';
  }
  if (result.response.status === 401) {
    await clear();
    return 'signedOut';
  }
  return 'unavailable';
}
