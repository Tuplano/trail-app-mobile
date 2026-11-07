import createClient from 'openapi-fetch';

import { env } from '@/config/env';
import { authMiddleware } from '@/features/auth/auth-middleware';

import type { paths } from './schema';

/**
 * Typed client for trail-app-api. Paths and bodies come from schema.d.ts,
 * which `npm run gen:api` regenerates from the API's /docs-json.
 */
export const api = createClient<paths>({
  baseUrl: env.apiUrl,
  // Look fetch up on each call (openapi-fetch would otherwise keep the one it saw
  // at startup), so requests and the auth middleware's retries use the same fetch.
  fetch: (request) => globalThis.fetch(request),
});

// Signs every request and refreshes the session when the API answers 401.
api.use(authMiddleware);

export type { components, paths } from './schema';
