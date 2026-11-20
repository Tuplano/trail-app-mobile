import { useMutation } from '@tanstack/react-query';
import * as Device from 'expo-device';
import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isNoSavedCredentialFoundResponse,
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
 * Goes through Google's steps in order: an account already used with the
 * app (often no tap needed), then the account chooser, then the full
 * "Sign in with Google" screen.
 */
export async function getGoogleIdToken(): Promise<string | null> {
  if (!configured) {
    // Only the email and name are needed (the default), no extra Google access.
    await GoogleOneTapSignIn.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  await GoogleOneTapSignIn.checkPlayServices();

  let response = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.createAccount();
  }
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.presentExplicitSignIn();
  }
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
