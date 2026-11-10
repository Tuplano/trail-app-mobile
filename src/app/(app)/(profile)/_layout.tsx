import { Stack } from 'expo-router';

import { useColors } from '@/theme/use-colors';

/** The Profile tab opens on the profile (there's no index screen here). */
export const unstable_settings = { initialRouteName: 'profile' };

/**
 * The Profile tab: the profile, with Settings pushed on top. Like History,
 * the tab holds a Stack, because native tabs have no header or push of their own.
 */
export default function ProfileLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.accentHi,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      {/* Only the back button, as in the design: the screen shows its title itself. */}
      <Stack.Screen name="settings" options={{ title: '', headerBackTitle: 'Profile' }} />
    </Stack>
  );
}
