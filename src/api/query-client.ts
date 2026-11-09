import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

// React Native has no window focus events: treat "app came to the foreground"
// as focus so stale queries refetch when the user returns to the app.
AppState.addEventListener('change', (status) => {
  focusManager.setFocused(status === 'active');
});
