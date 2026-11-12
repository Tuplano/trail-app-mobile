import { scrubBreadcrumb, sentryEnabled, withoutQuery } from '../sentry';

jest.mock('@sentry/react-native', () => ({ init: jest.fn(), wrap: jest.fn((c: unknown) => c) }));

describe('withoutQuery', () => {
  it('drops what was searched or sent in the address', () => {
    expect(withoutQuery('https://photon.komoot.io/api/?q=12%20Home%20St&limit=5')).toBe(
      'https://photon.komoot.io/api/',
    );
    expect(withoutQuery('http://api/api/v1/me#x')).toBe('http://api/api/v1/me');
    expect(withoutQuery('http://api/api/v1/me')).toBe('http://api/api/v1/me');
  });
});

describe('scrubBreadcrumb', () => {
  it('keeps where a request went, not its query', () => {
    expect(
      scrubBreadcrumb({ category: 'fetch', data: { url: 'https://x/api?q=home', status_code: 200 } }),
    ).toEqual({ category: 'fetch', data: { url: 'https://x/api', status_code: 200 } });
  });

  it('leaves other breadcrumbs alone', () => {
    const crumb = { category: 'navigation', data: { from: '/', to: '/record' } };
    expect(scrubBreadcrumb(crumb)).toBe(crumb);
  });
});

describe('sentryEnabled', () => {
  it('is off without a DSN', () => {
    expect(process.env.EXPO_PUBLIC_SENTRY_DSN).toBeUndefined();
    expect(sentryEnabled).toBe(false);
  });
});
