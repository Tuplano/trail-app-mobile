import createClient from 'openapi-fetch';

import { env } from '@/config/env';

import type { paths } from './schema';

/**
 * Typed client for trail-app-api. Paths and bodies come from schema.d.ts,
 * which `npm run gen:api` regenerates from the API's /docs-json.
 */
export const api = createClient<paths>({ baseUrl: env.apiUrl });

export type { components, paths } from './schema';
