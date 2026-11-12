import { ApiError, NETWORK_ERROR_MESSAGE, errorMessage } from '@/api/errors';
import type { RecorderStatus } from '@/tracking/recorder-store';

/** Where to show why deleting didn't work: under the password, or above the button. */
export type DeleteProblem = { field: string | null; form: string | null };

/** Turns a failed DELETE /me into words for the delete screen. */
export function describeDeleteError(error: unknown): DeleteProblem {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS') return { field: 'Wrong password.', form: null };
    if (error.code === 'VALIDATION_FAILED') return { field: 'Enter your password.', form: null };
    if (error.status === 429) {
      return { field: null, form: 'Too many tries. Wait a minute, then try again.' };
    }
    return { field: null, form: error.message };
  }
  if (error instanceof TypeError) return { field: null, form: NETWORK_ERROR_MESSAGE };
  return { field: null, form: errorMessage(error) };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The warning about what only this phone has: hikes and posts that haven't
 * uploaded are lost too. Null when everything is on the server.
 */
export function notUploadedWarning(counts: { hikes: number; posts: number }): string | null {
  const parts = [
    counts.hikes > 0 ? plural(counts.hikes, 'hike', 'hikes') : null,
    counts.posts > 0 ? plural(counts.posts, 'post', 'posts') : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  const what = parts.join(' and ');
  const verb = counts.hikes + counts.posts === 1 ? "isn't" : "aren't";
  const keep = counts.hikes > 0 ? ' Export hikes as GPX first if you want to keep them.' : '';
  return `${what} ${verb} uploaded yet and will be deleted from this phone too.${keep}`;
}

/** Why the delete button is off before anything is typed, or null when it can be used. */
export function deleteBlocker({
  recorder,
  online,
}: {
  recorder: RecorderStatus;
  online: boolean;
}): string | null {
  if (recorder === 'recording' || recorder === 'paused') {
    return 'You have a hike in progress. Finish or discard it on Record first.';
  }
  if (!online) return 'Deleting your account needs signal.';
  return null;
}
