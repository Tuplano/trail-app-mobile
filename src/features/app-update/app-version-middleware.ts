import type { Middleware } from 'openapi-fetch';

import { APP_VERSION, APP_VERSION_HEADER, noteUpdateRequired } from './app-update';

/**
 * Sends this build's version with every API request, and notices when the
 * API answers that it's too old (426), which shows the update page.
 */
export const appVersionMiddleware: Middleware = {
  onRequest({ request }) {
    request.headers.set(APP_VERSION_HEADER, APP_VERSION);
    return request;
  },
  onResponse({ response }) {
    noteUpdateRequired(response);
    return undefined;
  },
};
