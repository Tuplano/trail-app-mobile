import type { components } from './schema';

type ErrorBody = components['schemas']['ErrorResponse'];

/** An API failure in a shape screens can show: a message plus per-field messages. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ErrorBody).error?.message === 'string'
  );
}

/** Turns openapi-fetch's `error` and `response` into an ApiError. */
export function toApiError(error: unknown, response: Response): ApiError {
  if (!isErrorBody(error)) {
    return new ApiError(`Request failed (${response.status})`, response.status, 'UNKNOWN');
  }
  const fieldErrors: Record<string, string> = {};
  for (const detail of error.error.details ?? []) {
    fieldErrors[detail.path] ??= detail.message;
  }
  return new ApiError(error.error.message, response.status, error.error.code, fieldErrors);
}

/** fetch rejects (instead of returning a response) when there is no connection. */
export const NETWORK_ERROR_MESSAGE = "Can't reach Trailing right now. Check your connection.";

/**
 * Whether a request failed because the server couldn't be reached (no
 * signal, airplane mode), rather than because the server said no. The app's
 * fetch is expo/fetch, which throws its own FetchError ("fetch failed: …",
 * not exported, name "Error"); other fetches throw a TypeError.
 */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.message.startsWith('fetch failed'))
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (isNetworkError(error)) return NETWORK_ERROR_MESSAGE;
  return 'Something went wrong. Please try again.';
}
