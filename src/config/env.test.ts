import { parseAppEnv, resolveApiUrl } from './env';

describe('parseAppEnv', () => {
  it('defaults to development when unset', () => {
    expect(parseAppEnv(undefined)).toBe('development');
    expect(parseAppEnv('')).toBe('development');
  });

  it('accepts the known environments', () => {
    expect(parseAppEnv('staging')).toBe('staging');
    expect(parseAppEnv('production')).toBe('production');
  });

  it('rejects anything else', () => {
    expect(() => parseAppEnv('prod')).toThrow(/EXPO_PUBLIC_APP_ENV/);
  });
});

describe('resolveApiUrl', () => {
  it('uses the explicit URL and strips trailing slashes', () => {
    expect(
      resolveApiUrl({
        appEnv: 'production',
        explicitUrl: 'https://api.example.com//',
        metroHostUri: undefined,
      }),
    ).toBe('https://api.example.com');
  });

  it("points at the API on Metro's host in development", () => {
    expect(
      resolveApiUrl({
        appEnv: 'development',
        explicitUrl: undefined,
        metroHostUri: '192.168.1.20:8081',
      }),
    ).toBe('http://192.168.1.20:3000');
  });

  it('falls back to localhost when Metro host is unknown', () => {
    expect(
      resolveApiUrl({ appEnv: 'development', explicitUrl: undefined, metroHostUri: undefined }),
    ).toBe('http://localhost:3000');
  });

  it('requires an explicit URL outside development', () => {
    expect(() =>
      resolveApiUrl({ appEnv: 'staging', explicitUrl: undefined, metroHostUri: 'x:8081' }),
    ).toThrow(/EXPO_PUBLIC_API_URL is required/);
  });
});
