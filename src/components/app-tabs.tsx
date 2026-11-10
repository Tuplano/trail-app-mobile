import { NativeTabs } from 'expo-router/native-tabs';

import { useColors } from '@/theme/use-colors';

/**
 * The signed-in app's bottom tabs: the system tab bar on Android and iOS, in
 * the design's order and with icons close to its Phosphor ones (native tabs
 * take system icons). Feed is a placeholder until Stage 5.
 */
export default function AppTabs() {
  const colors = useColors();

  return (
    <NativeTabs
      backgroundColor={colors.bg}
      indicatorColor={colors.tint}
      labelStyle={{ selected: { color: colors.text } }}
      // Android hides unselected labels once there are 4+ tabs; the design labels every tab.
      labelVisibilityMode="labeled"
      // History is a FlatList, and native tabs can't always tell when a
      // FlatList is scrolled to the end; without this the bar can turn see-through on iOS.
      disableTransparentOnScrollEdge>
      <NativeTabs.Trigger name="record">
        <NativeTabs.Trigger.Label>Record</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="record.circle" md="radio_button_checked" />
      </NativeTabs.Trigger>

      {/* A folder with its own Stack, so a hike's screen opens inside the tab. */}
      <NativeTabs.Trigger name="(history)">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="feed">
        <NativeTabs.Trigger.Label>Feed</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.3" md="groups" />
      </NativeTabs.Trigger>

      {/* Also a folder with its own Stack, for Settings. */}
      <NativeTabs.Trigger name="(profile)">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
