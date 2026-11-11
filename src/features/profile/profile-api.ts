import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { queryClient } from '@/api/query-client';
import type { components } from '@/api/schema';
import { useAuthStore } from '@/features/auth/auth-store';
import type { User } from '@/features/auth/session-storage';

type UpdateMeBody = components['schemas']['UpdateMeDto'];

export const ME_QUERY_KEY = ['me'] as const;

/**
 * Saves the latest user to the device, unless the person signed out while the
 * request was in flight (that would write their details back after sign-out).
 */
async function keepUser(user: User): Promise<User> {
  const { status, setUser } = useAuthStore.getState();
  if (status === 'signedIn') await setUser(user);
  return user;
}

/**
 * Refreshes the signed-in user from GET /me. Screens read the user from the
 * auth store, which works offline; this query only keeps that copy current.
 */
export function useRefreshMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/api/v1/me');
      if (!data) throw toApiError(error, response);
      return keepUser(data);
    },
  });
}

/** PATCH /me with only the fields that changed. */
export function useUpdateMe() {
  return useMutation({
    mutationFn: async (body: UpdateMeBody) => {
      const { data, error, response } = await api.PATCH('/api/v1/me', { body });
      if (!data) throw toApiError(error, response);
      return keepUser(data);
    },
    onSuccess: (user) => {
      queryClient.setQueryData(ME_QUERY_KEY, user);
      // Your public profile (with the counts) shows the new name too.
      void queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    },
  });
}
