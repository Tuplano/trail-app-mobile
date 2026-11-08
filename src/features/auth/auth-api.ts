import { useMutation } from '@tanstack/react-query';
import * as Device from 'expo-device';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { queryClient } from '@/api/query-client';
import type { components } from '@/api/schema';

import { useAuthStore } from './auth-store';

type LoginBody = components['schemas']['LoginDto'];
type RegisterBody = components['schemas']['RegisterDto'];

/** Shown in the API's signed-in devices list, e.g. "Pixel 9". */
const deviceName = Device.modelName?.slice(0, 100) || undefined;

export function useSignIn() {
  return useMutation({
    mutationFn: async (body: Omit<LoginBody, 'deviceName'>) => {
      const { data, error, response } = await api.POST('/api/v1/auth/login', {
        body: { ...body, deviceName },
      });
      if (!data) throw toApiError(error, response);
      await useAuthStore.getState().signIn(data);
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: async (body: Omit<RegisterBody, 'deviceName'>) => {
      const { data, error, response } = await api.POST('/api/v1/auth/register', {
        body: { ...body, deviceName },
      });
      if (!data) throw toApiError(error, response);
      await useAuthStore.getState().signIn(data);
    },
  });
}

/**
 * Signs out on this device straight away, then tells the API to revoke the
 * refresh token. If that call fails (offline), the token simply expires.
 */
export async function signOut(): Promise<void> {
  const { session, clear } = useAuthStore.getState();
  await clear();
  queryClient.clear();
  if (session) {
    api
      .POST('/api/v1/auth/logout', { body: { refreshToken: session.refreshToken } })
      .catch(() => {});
  }
}
