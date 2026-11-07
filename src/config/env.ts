import Constants from 'expo-constants';

export const APP_ENVS = ['development', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Port the local API listens on (trail-app-api defaults PORT to 3000). */
const LOCAL_API_PORT = 3000;

export function parseAppEnv(value: string | undefined): AppEnv {
  if (value === undefined || value === '') return 'development';
  if ((APP_ENVS as readonly string[]).includes(value)) return value as AppEnv;
  throw new Error(`EXPO_PUBLIC_APP_ENV must be one of ${APP_ENVS.join(', ')}, got "${value}"`);
}

/**
 * The API origin, without a trailing slash and without /api/v1 (the generated
 * paths already include it).
 *
 * In development the API usually runs on the same machine as Metro, so when no
 * URL is set we reuse Metro's host. That makes a physical phone on the same
 * Wi-Fi reach the laptop's API, which `localhost` never would.
 */
export function resolveApiUrl(options: {
  appEnv: AppEnv;
  explicitUrl: string | undefined;
  metroHostUri: string | undefined;
}): string {
  const { appEnv, explicitUrl, metroHostUri } = options;
  if (explicitUrl) return explicitUrl.replace(/\/+$/, '');

  if (appEnv !== 'development') {
    throw new Error(`EXPO_PUBLIC_API_URL is required when EXPO_PUBLIC_APP_ENV is "${appEnv}"`);
  }

  // hostUri looks like "192.168.1.20:8081"; keep the host, swap in the API port.
  const host = metroHostUri?.split(':')[0] || 'localhost';
  return `http://${host}:${LOCAL_API_PORT}`;
}

// process.env.EXPO_PUBLIC_* must be read with dot access so Metro can inline them.
const appEnv = parseAppEnv(process.env.EXPO_PUBLIC_APP_ENV);

export const env = {
  appEnv,
  apiUrl: resolveApiUrl({
    appEnv,
    explicitUrl: process.env.EXPO_PUBLIC_API_URL,
    metroHostUri: Constants.expoConfig?.hostUri,
  }),
} as const;
