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

export function validateSignUp(form: SignUpForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!EMAIL.test(form.email.trim())) errors.email = 'Enter a valid email.';

  const username = form.username.trim();
  if (username.length < 3 || username.length > 30) {
    errors.username = 'Use 3 to 30 characters.';
  } else if (!USERNAME.test(username)) {
    errors.username = 'Use only letters, numbers, and underscores.';
  }

  const displayName = form.displayName.trim();
  if (!displayName) errors.displayName = 'Enter your name.';
  else if (displayName.length > 50) errors.displayName = 'Use 50 characters or fewer.';

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
