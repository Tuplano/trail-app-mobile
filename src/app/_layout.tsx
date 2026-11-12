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
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { queryClient } from '@/api/query-client';
import { initSentry, withSentry } from '@/config/sentry';
import { UpdateRequired } from '@/features/app-update/update-required';
import { BadgeUnlocks } from '@/features/achievements/badge-unlocks';
import { useAuthStore } from '@/features/auth/auth-store';
import { useColors } from '@/theme/use-colors';
// Defines the background location task. It must load at startup, because the
// OS can wake the app just to deliver GPS fixes, with no screen mounted.
import '@/tracking/location-task';

// The design is dark, so the app is too, whatever the phone's setting. Native
// parts (tab bar, status bar, map controls) follow this as well as our colors.
// The light palette stays in tokens.ts for a theme switch in Settings later.
Appearance.setColorScheme('dark');

// Crash reports, as early as possible (does nothing until a Sentry DSN is set).
initSentry();

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 300 });

function RootLayout() {
  const colorScheme = useColorScheme();
  const authStatus = useAuthStore((s) => s.status);
  const colors = useColors();
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
  const ready = authStatus !== 'loading' && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  const signedIn = authStatus === 'signedIn';
  // A back button on the app's background, like History's and Profile's stacks.
  const peopleScreen = {
    headerShown: true,
    title: '',
    animation: 'default',
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.accentHi,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.bg },
  } as const;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'light' ? DefaultTheme : DarkTheme}>
        {/* Light clock and icons on the dark theme (dark ones if the theme is ever light). */}
        <StatusBar style="auto" />
        {/*
          Protected screens only exist while their guard is true. Opening one
          that doesn't exist (or signing in/out) redirects to the first screen
          that does: the app when signed in, sign-in when signed out.
        */}
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(app)" />
            {/* Over the tabs (the design hides them here), sliding up like a sheet. */}
            <Stack.Screen name="new-post/[hikeId]" options={{ animation: 'slide_from_bottom' }} />
            {/*
              People: someone's profile, follow lists and search. Not in the
              design; they sit over the tabs so any tab can open them, with
              only a back button (each screen shows its own title).
            */}
            <Stack.Screen name="users/[id]/index" options={peopleScreen} />
            <Stack.Screen name="users/[id]/followers" options={peopleScreen} />
            <Stack.Screen name="users/[id]/following" options={peopleScreen} />
            <Stack.Screen name="search" options={peopleScreen} />
            {/* Also over the tabs, so the new-post screen can open it and keep the post. */}
            <Stack.Screen name="privacy-zones" options={peopleScreen} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
          </Stack.Protected>
        </Stack>
        {/* Badge unlock banner and pop-up, over every signed-in screen. */}
        {signedIn && <BadgeUnlocks />}
        {/* Over everything, signed in or not, once the API says this version is too old. */}
        <UpdateRequired />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default withSentry(RootLayout);
