import { ApiError } from '@/api/errors';

/** First wait after a failure. */
export const FIRST_RETRY_MS = 60_000;
/** Longest wait between tries, however many failures. */
export const MAX_RETRY_MS = 60 * 60_000;

/**
 * How long to wait before trying an item again, given how many times it has
 * already failed: 1 min, 2, 4, 8, 16, 32, then every hour. Waiting longer each
 * time spares the battery and the server while something is broken, and the
 * cap means a hike still goes up within the hour once it's fixed.
 */
export function retryDelayMs(failuresSoFar: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** Math.max(0, failuresSoFar), MAX_RETRY_MS);
}

/**
 * Thrown by an upload handler when retrying can never help (the server
 * rejected the data, or it isn't this user's). The outbox then drops the item
 * instead of retrying it forever. The original error is kept as `reason`.
 */
export class GiveUpError extends Error {
  constructor(readonly reason: unknown) {
    super(reason instanceof Error ? reason.message : String(reason));
    this.name = 'GiveUpError';
  }
}

/**
 * Thrown by an upload handler when the item can't go yet for a reason that
 * isn't a failure, e.g. its photos wait for Wi-Fi. The outbox leaves it as
 * it is: no attempt counted and no backoff, so it goes on the first run once
 * the reason is gone.
 */
export class NotYetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotYetError';
  }
}

/**
 * API errors that will fail the same way however often they're retried:
 * 400 bad data, 403/404 not this user's (or deleted), 409 conflicts other than
 * missing points (which a resend fixes). Network errors, 401 (session, handled
 * by refresh) and 5xx (server trouble) are worth retrying.
 */
export function isPermanent(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 409) return error.code !== 'POINTS_MISSING';
  return error.status === 400 || error.status === 403 || error.status === 404;
}
