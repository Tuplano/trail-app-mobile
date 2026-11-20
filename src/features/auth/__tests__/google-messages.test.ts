import { ApiError, NETWORK_ERROR_MESSAGE } from '@/api/errors';

import { googleSignInMessage } from '../google-messages';

const apiError = (code: string, status = 400) => new ApiError(`API says ${code}`, status, code);
const googleError = (code: string) => Object.assign(new Error(code), { code });

describe('googleSignInMessage', () => {
  it('says nothing when there is no error', () => {
    expect(googleSignInMessage(null)).toBeNull();
  });

  it('sends a hiker with a password account to the password form', () => {
    expect(googleSignInMessage(apiError('EMAIL_TAKEN', 409))).toMatch(/Sign in with your email and password/);
  });

  it('explains the API refusals in plain words', () => {
    expect(googleSignInMessage(apiError('GOOGLE_EMAIL_NOT_VERIFIED', 401))).toMatch(/isn't verified/);
    expect(googleSignInMessage(apiError('INVALID_GOOGLE_TOKEN', 401))).toMatch(/try again/);
    expect(googleSignInMessage(apiError('GOOGLE_SIGN_IN_DISABLED', 503))).toMatch(/isn't available/);
  });

  it("keeps the API's own message for anything else", () => {
    expect(googleSignInMessage(apiError('TOO_MANY_REQUESTS', 429))).toBe('API says TOO_MANY_REQUESTS');
  });

  it("explains the Google library's failures", () => {
    expect(googleSignInMessage(googleError('PLAY_SERVICES_NOT_AVAILABLE'))).toMatch(/Google Play services/);
    expect(googleSignInMessage(googleError('DEVELOPER_ERROR'))).toMatch(/isn't set up/);
    expect(googleSignInMessage(googleError('ONE_TAP_START_FAILED'))).toMatch(/Couldn't open/);
  });

  it('stays quiet when a Google sign-in is already open', () => {
    expect(googleSignInMessage(googleError('IN_PROGRESS'))).toBeNull();
  });

  it('says to check the connection when offline', () => {
    expect(googleSignInMessage(new TypeError('Network request failed'))).toBe(NETWORK_ERROR_MESSAGE);
  });
});
