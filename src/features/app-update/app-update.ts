import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { create } from 'zustand';

/**
 * This build's version, from app.json ("1.0.0"). Sent with every API
 * request, so the API can turn away versions it no longer works with.
 */
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
export const APP_VERSION_HEADER = 'X-App-Version';
/** The oldest version the API accepts, in its 426 answer. */
const MIN_APP_VERSION_HEADER = 'X-Min-App-Version';
/** The API's "this app is too old" answer: 426 APP_UPDATE_REQUIRED. */
const UPGRADE_REQUIRED = 426;

/**
 * Whether an API answer says this version is too old, and if so the oldest
 * version it takes (null if it didn't say). Undefined when it's any other answer.
 */
export function updateRequiredBy(response: {
  status: number;
  headers: { get(name: string): string | null };
}): { minVersion: string | null } | undefined {
  if (response.status !== UPGRADE_REQUIRED) return undefined;
  return { minVersion: response.headers.get(MIN_APP_VERSION_HEADER) };
}

type UpdateState = {
  /** Set once the API has said this version is too old; stays until the app restarts. */
  required: { minVersion: string | null } | null;
  /** The hiker stepped past the update page to finish a hike in progress. */
  hidden: boolean;
  require: (minVersion: string | null) => void;
  hide: () => void;
};

export const useAppUpdateStore = create<UpdateState>()((set) => ({
  required: null,
  hidden: false,
  require: (minVersion) => set({ required: { minVersion }, hidden: false }),
  hide: () => set({ hidden: true }),
}));

/** Notes a 426 from the API, wherever the request came from. */
export function noteUpdateRequired(response: Parameters<typeof updateRequiredBy>[0]): void {
  const required = updateRequiredBy(response);
  if (required) useAppUpdateStore.getState().require(required.minVersion);
}

/** Where to get the new version: the store listing for this app's id. */
export function storeUrl(): string | null {
  if (Platform.OS === 'android') {
    const id = Constants.expoConfig?.android?.package;
    return id ? `market://details?id=${id}` : null;
  }
  return Constants.expoConfig?.ios?.appStoreUrl ?? null;
}

/** The same listing in a browser, for phones without the Play Store app. */
export function storeWebUrl(): string | null {
  const id = Constants.expoConfig?.android?.package;
  return Platform.OS === 'android' && id
    ? `https://play.google.com/store/apps/details?id=${id}`
    : null;
}
