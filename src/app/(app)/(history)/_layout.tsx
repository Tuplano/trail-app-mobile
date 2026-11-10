import { Stack } from 'expo-router';

import { useColors } from '@/theme/use-colors';

/**
 * The History tab: the list of hikes, with a hike's screen pushed on top.
 * Native tabs have no header or push of their own, so the tab holds a Stack.
 */
export default function HistoryLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.accentHi,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/*
        Only the back button, as in the design (labelled "History" on iOS, an
        arrow on Android): the screen shows the hike's name itself.
      */}
      <Stack.Screen name="hikes/[id]" options={{ title: '', headerBackTitle: 'History' }} />
    </Stack>
  );
}
