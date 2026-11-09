import type { components } from '@/api/schema';
import { displayNameError, type FieldErrors, usernameError } from '@/features/auth/validation';

export type ProfileForm = { username: string; displayName: string };
export type ProfileChanges = components['schemas']['UpdateMeDto'];

export function validateProfile(form: ProfileForm): FieldErrors {
  const errors: FieldErrors = {};
  const username = usernameError(form.username.trim());
  if (username) errors.username = username;
  const displayName = displayNameError(form.displayName.trim());
  if (displayName) errors.displayName = displayName;
  return errors;
}

/**
 * The trimmed fields that differ from the saved user. PATCH /me leaves out
 * fields it isn't sent, so an empty object means there is nothing to save.
 */
export function profileChanges(form: ProfileForm, saved: ProfileForm): ProfileChanges {
  const changes: ProfileChanges = {};
  const username = form.username.trim();
  const displayName = form.displayName.trim();
  if (username !== saved.username) changes.username = username;
  if (displayName !== saved.displayName) changes.displayName = displayName;
  return changes;
}

/** Up to two initials for the avatar placeholder, e.g. "Maya Okafor" → "MO". */
export function initials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase();
}
