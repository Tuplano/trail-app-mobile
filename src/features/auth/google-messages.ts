import { ApiError, errorMessage } from '@/api/errors';

/**
 * What to tell the hiker when "Continue with Google" fails. Google sign-in has
 * no form fields, so everything is one message at the top of the screen.
 *
 * - API refusals (an ApiError) come from POST /auth/google or /me/google
 *   (connecting: the API's own words, e.g. "Choose the Google account for
 *   you@example.com.", are clear as they are).
 * - The Google library's own failures carry a `code` (its statusCodes).
 * - Anything else (offline, a bug) gets the app's usual wording.
 */
export function googleSignInMessage(error: unknown): string | null {
  if (!error) return null;

  if (error instanceof ApiError) {
    switch (error.code) {
      case 'EMAIL_TAKEN':
        return 'This email already has a Trailing password. Sign in with your email and password, then connect Google in Settings.';
      case 'GOOGLE_EMAIL_NOT_VERIFIED':
        return "Your Google account's email isn't verified yet. Verify it with Google, then try again.";
      case 'INVALID_GOOGLE_TOKEN':
        return "Google didn't confirm who you are. Please try again.";
      case 'GOOGLE_SIGN_IN_DISABLED':
        return "Google sign-in isn't available right now. Use your email and password instead.";
      default:
        return errorMessage(error);
    }
  }

  const code = typeof error === 'object' && 'code' in error ? (error as { code: unknown }).code : null;
  switch (code) {
    case 'PLAY_SERVICES_NOT_AVAILABLE':
      return 'Google sign-in needs Google Play services. Update them in the Play Store, then try again.';
    case 'IN_PROGRESS':
      return null; // a sign-in is already open; that one will finish
    case 'DEVELOPER_ERROR':
      // The app's package/signing key isn't registered in Google Cloud.
      return "Google sign-in isn't set up for this version of the app. Use your email and password instead.";
    case 'ONE_TAP_START_FAILED':
    case 'SIGN_IN_REQUIRED':
      return "Couldn't open Google sign-in. Please try again.";
    default:
      return errorMessage(error);
  }
}
