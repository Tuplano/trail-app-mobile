import { ApiError } from '@/api/errors';

import { FIRST_RETRY_MS, isPermanent, MAX_RETRY_MS, retryDelayMs } from '../retry';

const MIN = 60_000;

describe('retryDelayMs', () => {
  it('doubles the wait after each failure, up to an hour', () => {
    expect(FIRST_RETRY_MS).toBe(MIN);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 30].map((n) => retryDelayMs(n) / MIN)).toEqual([
      1, 2, 4, 8, 16, 32, 60, 60, 60,
    ]);
    expect(retryDelayMs(1000)).toBe(MAX_RETRY_MS);
  });
});

describe('isPermanent', () => {
  const api = (status: number, code = 'X') => new ApiError('nope', status, code);

  it('gives up on errors that will always fail the same way', () => {
    expect(isPermanent(api(400, 'VALIDATION_FAILED'))).toBe(true);
    expect(isPermanent(api(403, 'FORBIDDEN'))).toBe(true);
    expect(isPermanent(api(404, 'HIKE_NOT_FOUND'))).toBe(true);
    expect(isPermanent(api(409, 'HIKE_FINISHED'))).toBe(true);
  });

  it('keeps retrying errors that may pass later', () => {
    expect(isPermanent(api(409, 'POINTS_MISSING'))).toBe(false); // a resend fixes it
    expect(isPermanent(api(401, 'ACCESS_TOKEN_EXPIRED'))).toBe(false);
    expect(isPermanent(api(500))).toBe(false);
    expect(isPermanent(api(503))).toBe(false);
    expect(isPermanent(new TypeError('Network request failed'))).toBe(false);
  });
});
