import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { LocationAccess } from '@/tracking/location-permission';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

type Copy = { title: string; body: string; action: string };

const ios = Platform.OS === 'ios';

/** What to tell the user for each missing step, in the words their phone uses. */
const COPY: Record<Exclude<LocationAccess, 'ready'>, Copy> = {
  'services-off': {
    title: 'Turn on location',
    body: ios
      ? "Your phone's Location Services are off. Turn them on in Settings → Privacy & Security → Location Services."
      : "Your phone's location is off. Trail needs it to record your route.",
    action: ios ? 'Open Settings' : 'Turn on location',
  },
  'ask-foreground': {
    title: 'Allow location',
    body: "Trail uses your phone's GPS to record the route of your hike. It works without signal.",
    action: 'Continue',
  },
  'foreground-blocked': {
    title: 'Location is off for Trail',
    body: ios
      ? 'In Settings, tap Location and choose "Always".'
      : 'In Settings, open Permissions → Location and choose "Allow all the time".',
    action: 'Open Settings',
  },
  approximate: {
    title: 'Turn on precise location',
    body: ios
      ? 'Trail needs your exact position to draw your route. In Settings, tap Location and turn on Precise Location.'
      : 'Trail needs your exact position to draw your route. In Settings, open Permissions → Location and turn on "Use precise location".',
    action: 'Open Settings',
  },
  'ask-background': {
    title: 'Keep recording with the screen locked',
    body: ios
      ? 'Next, choose "Change to Always Allow". Without it, recording stops when you lock your phone.'
      : 'On the next screen, choose "Allow all the time". Without it, recording stops when you lock your phone or switch apps.',
    action: 'Continue',
  },
  'background-blocked': {
    title: 'Allow location all the time',
    body: ios
      ? 'To keep recording with the screen locked, open Settings, tap Location and choose "Always".'
      : 'To keep recording with the screen locked, open Settings → Permissions → Location and choose "Allow all the time".',
    action: 'Open Settings',
  },
};

/** Explains the one missing location step and offers the button that fixes it. */
export function LocationAccessCard({
  access,
  fixing,
  onFix,
}: {
  access: Exclude<LocationAccess, 'ready'>;
  fixing: boolean;
  onFix: () => void;
}) {
  const colors = useColors();
  const copy = COPY[access];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      <View style={styles.text}>
        <Text variant="subheading">{copy.title}</Text>
        <Text variant="small" color="muted">
          {copy.body}
        </Text>
      </View>
      <Button label={copy.action} onPress={onFix} loading={fixing} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  text: {
    gap: 6,
  },
});
