import { ApiError, errorMessage } from '@/api/errors';

export type FieldErrors = Record<string, string>;

export type SignInForm = { email: string; password: string };
export type SignUpForm = SignInForm & { username: string; displayName: string };

// Same rules as the API's RegisterDto, checked here so mistakes show instantly.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-zA-Z0-9_]+$/;

export function validateSignIn(form: SignInForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!EMAIL.test(form.email.trim())) errors.email = 'Enter a valid email.';
  if (!form.password) errors.password = 'Enter your password.';
  return errors;
}

/** The API's username rule (shared by sign-up and PATCH /me). Expects a trimmed value. */
export function usernameError(username: string): string | null {
  if (username.length < 3 || username.length > 30) return 'Use 3 to 30 characters.';
  if (!USERNAME.test(username)) return 'Use only letters, numbers, and underscores.';
  return null;
}

/** The API's display name rule (shared by sign-up and PATCH /me). Expects a trimmed value. */
export function displayNameError(displayName: string): string | null {
  if (!displayName) return 'Enter your name.';
  if (displayName.length > 50) return 'Use 50 characters or fewer.';
  return null;
}

export function validateSignUp(form: SignUpForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!EMAIL.test(form.email.trim())) errors.email = 'Enter a valid email.';

  const username = usernameError(form.username.trim());
  if (username) errors.username = username;

  const displayName = displayNameError(form.displayName.trim());
  if (displayName) errors.displayName = displayName;

  if (form.password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (form.password.length > 128) errors.password = 'Use 128 characters or fewer.';
  return errors;
}

/** "Taken" conflicts come back without field details, so map their codes to a field. */
const FIELD_FOR_CODE: Record<string, string> = {
  EMAIL_TAKEN: 'email',
  USERNAME_TAKEN: 'username',
};

/**
 * Splits a failed request into messages under specific fields and one general
 * message for the top of the form.
 */
export function describeAuthError(error: unknown): { fields: FieldErrors; form: string | null } {
  if (!error) return { fields: {}, form: null };
  // No response at all (offline) or an unexpected bug.
  if (!(error instanceof ApiError)) return { fields: {}, form: errorMessage(error) };
  const field = FIELD_FOR_CODE[error.code];
  if (field) return { fields: { [field]: error.message }, form: null };
  if (Object.keys(error.fieldErrors).length > 0) return { fields: error.fieldErrors, form: null };
  return { fields: {}, form: error.message };
}
