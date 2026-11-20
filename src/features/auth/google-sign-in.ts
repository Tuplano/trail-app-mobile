import { useMutation } from '@tanstack/react-query';
import * as Device from 'expo-device';
import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isSuccessResponse,
} from 'react-native-nitro-google-signin';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { GOOGLE_WEB_CLIENT_ID } from '@/config/google';

import { useAuthStore } from './auth-store';

/** Shown in the API's signed-in devices list, e.g. "Pixel 9". */
const deviceName = Device.modelName?.slice(0, 100) || undefined;

let configured = false;

/**
 * Asks Google who the hiker is and returns the ID token to send to the API,
 * or null if they closed Google's sheet without picking an account.
 *
 * Opens Google's full "Sign in with Google" screen: every Google account on
 * the phone, plus "Add another account". Both callers are a button the
 * hiker tapped to choose, so the silent step that reuses the last account
 * (signIn()) is skipped: it gave no way to pick or add another one.
 */
export async function getGoogleIdToken(): Promise<string | null> {
  if (!configured) {
    // Only the email and name are needed (the default), no extra Google access.
    await GoogleOneTapSignIn.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  await GoogleOneTapSignIn.checkPlayServices();

  const response = await GoogleOneTapSignIn.presentExplicitSignIn();
  if (isCancelledResponse(response) || !isSuccessResponse(response)) return null;
  return response.data.idToken;
}

/**
 * Signs in (or, the first time, signs up) with Google: the phone gets an ID
 * token from Google, the API checks it and returns a Trailing session.
 * Resolves false when the hiker cancelled, true once signed in.
 *
 * The API refuses an email that already has a password account (EMAIL_TAKEN),
 * so one person never ends up with two accounts.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const idToken = await getGoogleIdToken();
  if (!idToken) return false;

  const { data, error, response } = await api.POST('/api/v1/auth/google', {
    body: { idToken, deviceName },
  });
  if (!data) throw toApiError(error, response);
  // isNewUser isn't part of the saved session.
  const { isNewUser: _isNewUser, ...result } = data;
  await useAuthStore.getState().signIn(result);
  return true;
}

/** "Continue with Google" on the sign-in and sign-up screens. */
export function useGoogleSignIn() {
  return useMutation({ mutationFn: signInWithGoogle });
}

/**
 * Connects Google to the signed-in account (#13.2), so "Continue with
 * Google" signs in to it too; the password keeps working. The API only
 * accepts the Google account with the same email as this account. Resolves
 * false when the hiker cancelled, true once connected (the saved user then
 * says googleConnected).
 */
export async function connectGoogle(): Promise<boolean> {
  const idToken = await getGoogleIdToken();
  if (!idToken) return false;

  const { data, error, response } = await api.POST('/api/v1/me/google', { body: { idToken } });
  if (!data) throw toApiError(error, response);
  const { status, setUser } = useAuthStore.getState();
  if (status === 'signedIn') await setUser(data); // not if they signed out meanwhile
  return true;
}

/** The "Google" row in Settings. */
export function useConnectGoogle() {
  return useMutation({ mutationFn: connectGoogle });
}
