import { ApiError, NETWORK_ERROR_MESSAGE, errorMessage, isNetworkError } from '../errors';

/** What expo/fetch (the app's fetch) throws with no connection: its FetchError. */
const expoFetchOffline = () => new Error('fetch failed: Unable to resolve host "10.0.2.2"');

describe('isNetworkError', () => {
  it("knows expo/fetch's error and other fetches' TypeError as no connection", () => {
    expect(isNetworkError(expoFetchOffline())).toBe(true);
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
  });

  it('is false for anything else', () => {
    expect(isNetworkError(new ApiError('Nope', 401, 'UNAUTHENTICATED'))).toBe(false);
    expect(isNetworkError(new Error('Something broke'))).toBe(false);
    expect(isNetworkError('fetch failed')).toBe(false);
  });
});

describe('errorMessage', () => {
  it('says to check the connection when offline, not "something went wrong"', () => {
    expect(errorMessage(expoFetchOffline())).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("shows the API's own message", () => {
    expect(errorMessage(new ApiError('Wrong password.', 401, 'INVALID_CREDENTIALS'))).toBe(
      'Wrong password.',
    );
  });
});
