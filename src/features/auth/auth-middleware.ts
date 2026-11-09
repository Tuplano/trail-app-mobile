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

    // If the token changed while this request was in flight, another request
    // already refreshed, so just retry. Otherwise refresh first.
    const tokenNow = useAuthStore.getState().session?.accessToken;
    if (tokenNow === entry.token) {
      const result = await refreshSession();
      // Signed out or offline: hand the original 401 back to the caller.
      if (result !== 'refreshed') return undefined;
    }

    const newToken = useAuthStore.getState().session?.accessToken;
    if (!newToken) return undefined;
    entry.retry.headers.set('Authorization', `Bearer ${newToken}`);
    return asResponse(await fetch(entry.retry));
  },

  onError({ id }) {
    sent.delete(id);
  },
};
