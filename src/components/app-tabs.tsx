import { NativeTabs } from 'expo-router/native-tabs';

import { useColors } from '@/theme/use-colors';

/** The signed-in app's bottom tabs: the system tab bar on Android and iOS. */
export default function AppTabs() {
  const colors = useColors();

  return (
    <NativeTabs
      backgroundColor={colors.bg}
      indicatorColor={colors.tint}
      labelStyle={{ selected: { color: colors.text } }}
      // Home's history is a FlatList, and native tabs can't always tell when a
      // FlatList is scrolled to the end; without this the bar can turn see-through on iOS.
      disableTransparentOnScrollEdge>
      {/* A folder with its own Stack, so a hike's details open inside the tab. */}
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="record">
        <NativeTabs.Trigger.Label>Record</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="figure.hiking" md="hiking" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
