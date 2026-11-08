import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { queryClient } from '@/api/query-client';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useAuthStore } from '@/features/auth/auth-store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const authStatus = useAuthStore((s) => s.status);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  // Keep the native splash screen up until we know who is signed in and the
  // fonts are ready. If fonts fail, carry on with the system font.
  if (authStatus === 'loading' || (!fontsLoaded && !fontError)) return null;

  const signedIn = authStatus === 'signedIn';

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'light' ? DefaultTheme : DarkTheme}>
        <AnimatedSplashOverlay />
        {/*
          Protected screens only exist while their guard is true. Opening one
          that doesn't exist (or signing in/out) redirects to the first screen
          that does: the app when signed in, sign-in when signed out.
        */}
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
