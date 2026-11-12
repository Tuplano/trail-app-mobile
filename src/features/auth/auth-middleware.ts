import type { Middleware } from 'openapi-fetch';

import { useAuthStore } from './auth-store';
import { refreshSession } from './refresh-session';

/** Login, register, refresh, and logout don't take an access token. */
const isAuthRoute = (schemaPath: string) => schemaPath.startsWith('/api/v1/auth/');

/** Statuses whose response may not have a body. */
const NO_BODY = new Set([204, 205, 304]);

/**
 * The app's global fetch is expo/fetch, whose responses aren't instances of
 * the global Response class, and openapi-fetch rejects anything else from a
 * middleware ("must return new Response()"). Copy the response into one.
 */
async function asResponse(
  response: Pick<Response, 'status' | 'statusText' | 'headers' | 'text'>,
): Promise<Response> {
  if (response instanceof Response) return response;
  const body = NO_BODY.has(response.status) ? null : await response.text();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/** 401 codes about what the user typed, not about the session. */
const CONFIRM_FAILURES = new Set(['INVALID_CREDENTIALS', 'INVALID_GOOGLE_TOKEN']);

/** The API's error code in a response, or null; leaves the response readable. */
async function errorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as { error?: { code?: unknown } } | null;
    return typeof body?.error?.code === 'string' ? body.error.code : null;
  } catch {
    return null;
  }
}

/** A copy of each sent request (bodies can only be read once) and the token it used. */
const sent = new Map<string, { retry: Request; token: string }>();

/**
 * Adds the access token to every request. On a 401 it refreshes the session
 * once and replays the request with the new token.
 */
export const authMiddleware: Middleware = {
  onRequest({ request, schemaPath, id }) {
    const token = useAuthStore.getState().session?.accessToken;
    if (!token || isAuthRoute(schemaPath)) return undefined;

    request.headers.set('Authorization', `Bearer ${token}`);
    sent.set(id, { retry: request.clone(), token });
    return request;
  },

  async onResponse({ response, id }) {
    const entry = sent.get(id);
    sent.delete(id);
    if (response.status !== 401 || !entry) return undefined;

    // Read once here (expo/fetch bodies can't be read twice), then hand back this copy.
    const original = await asResponse(response);
    // A wrong password typed to confirm something (deleting the account) is a
    // 401 too, but the session is fine: refreshing would only send it again.
    if (CONFIRM_FAILURES.has((await errorCode(original)) ?? '')) return original;

    // If the token changed while this request was in flight, another request
    // already refreshed, so just retry. Otherwise refresh first.
    const tokenNow = useAuthStore.getState().session?.accessToken;
    if (tokenNow === entry.token) {
      const result = await refreshSession();
      // Signed out or offline: hand the original 401 back to the caller.
      if (result !== 'refreshed') return original;
    }

    const newToken = useAuthStore.getState().session?.accessToken;
    if (!newToken) return original;
    entry.retry.headers.set('Authorization', `Bearer ${newToken}`);
    return asResponse(await fetch(entry.retry));
  },

  onError({ id }) {
    sent.delete(id);
  },
};
