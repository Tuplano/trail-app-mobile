import * as SecureStore from 'expo-secure-store';

import type { components } from '@/api/schema';

export type User = components['schemas']['UserDto'];
export type Session = components['schemas']['TokensResponseDto'];

const SESSION_KEY = 'auth.session';
const USER_KEY = 'auth.user';

// AFTER_FIRST_UNLOCK: the sync worker must read tokens while the phone is locked mid-hike.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key, options);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * The saved session and user, or null when signed out. The user is kept too, so
 * the app can open signed in (and show who you are) without any network.
 */
export async function loadSession(): Promise<{ session: Session; user: User } | null> {
  const [session, user] = await Promise.all([
    readJson<Session>(SESSION_KEY),
    readJson<User>(USER_KEY),
  ]);
  return session && user ? { session, user } : null;
}

export function saveSession(session: Session): Promise<void> {
  return SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), options);
}

export function saveUser(user: User): Promise<void> {
  return SecureStore.setItemAsync(USER_KEY, JSON.stringify(user), options);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEY, options),
    SecureStore.deleteItemAsync(USER_KEY, options),
  ]);
}
