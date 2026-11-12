import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

import { env } from './env';

/**
 * Crash and error reports, sent to Sentry (sentry.io). On only when
 * EXPO_PUBLIC_SENTRY_DSN is set (the project's key, from sentry.io →
 * Project → Client Keys), so local builds stay quiet until then.
 *
 * Nothing personal goes in a report: no email or IP (sendDefaultPii off),
 * no request bodies, and no URL queries, because place searches carry what
 * was typed (it can be a home address).
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!DSN;

/** A URL without its query and fragment: "https://x/api?q=home" → "https://x/api". */
export function withoutQuery(url: string): string {
  return url.split(/[?#]/)[0];
}

type Crumb = { category?: string; data?: Record<string, unknown> };

/**
 * Trims a breadcrumb (what happened before an error) to what's safe to
 * send: request URLs lose their query.
 */
export function scrubBreadcrumb<T extends Crumb>(crumb: T): T {
  const url = crumb.data?.url;
  if (typeof url !== 'string') return crumb;
  return { ...crumb, data: { ...crumb.data, url: withoutQuery(url) } };
}

/** Starts Sentry once, at app start. Does nothing without a DSN. */
export function initSentry(): void {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: env.appEnv,
    release: Constants.expoConfig?.version,
    sendDefaultPii: false,
    // Errors and crashes only: no performance tracing, profiling or replays.
    tracesSampleRate: 0,
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
    beforeSend: (event) => {
      if (event.request) {
        delete event.request.data;
        if (event.request.url) event.request.url = withoutQuery(event.request.url);
        delete event.request.query_string;
      }
      return event;
    },
  });
}

/** Wraps the root component so Sentry sees errors in rendering; as is without a DSN. */
export function withSentry<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  return sentryEnabled ? Sentry.wrap(Component) : Component;
}
