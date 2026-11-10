import { Stack } from 'expo-router';

import { useColors } from '@/theme/use-colors';

/**
 * The Home tab: the hike history, with a hike's details pushed on top.
 * Native tabs have no header or push of their own, so the tab holds a Stack.
 */
export default function HomeLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Only the back button: the screen shows the hike's name itself, in the app's type. */}
      <Stack.Screen name="hikes/[id]" options={{ title: '' }} />
    </Stack>
  );
}
