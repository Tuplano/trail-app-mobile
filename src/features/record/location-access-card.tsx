import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { LocationAccess } from '@/tracking/location-permission';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

type Copy = { title: string; body: string; action: string };

/**
 * Google Play's required "prominent disclosure": shown before the app asks
 * for location (both steps), in Google's own words ("location", "even when
 * the app is closed or not in use", and the feature). Reviewers look for it,
 * so keep these words if the card changes. See Notion task 51.
 */
export const BACKGROUND_LOCATION_DISCLOSURE =
  "Trailing collects location data to record your hike's route even when the app is closed or not in use.";

/**
 * What to tell the user for each missing step, in the words their phone uses.
 * Takes the platform so tests can check both.
 */
export function locationAccessCopy(
  access: Exclude<LocationAccess, 'ready'>,
  os: typeof Platform.OS = Platform.OS,
): Copy {
  const ios = os === 'ios';
  switch (access) {
    case 'services-off':
      return {
        title: 'Turn on location',
        body: ios
          ? "Your phone's Location Services are off. Turn them on in Settings → Privacy & Security → Location Services."
          : "Your phone's location is off. Trailing needs it to record your route.",
        action: ios ? 'Open Settings' : 'Turn on location',
      };
    case 'ask-foreground':
      return {
        title: 'Allow location',
        // Google wants the disclosure before the first location request too.
        body: `${BACKGROUND_LOCATION_DISCLOSURE} It uses your phone's GPS and works without signal.`,
        action: 'Continue',
      };
    case 'foreground-blocked':
      return {
        title: 'Location is off for Trailing',
        body: ios
          ? 'In Settings, tap Location and choose "Always".'
          : 'In Settings, open Permissions → Location and choose "Allow all the time".',
        action: 'Open Settings',
      };
    case 'approximate':
      return {
        title: 'Turn on precise location',
        body: ios
          ? 'Trailing needs your exact position to draw your route. In Settings, tap Location and turn on Precise Location.'
          : 'Trailing needs your exact position to draw your route. In Settings, open Permissions → Location and turn on "Use precise location".',
        action: 'Open Settings',
      };
    case 'ask-background':
      return {
        title: 'Keep recording with the screen locked',
        body: ios
          ? `${BACKGROUND_LOCATION_DISCLOSURE} Next, choose "Change to Always Allow". Without it, recording stops when you lock your phone.`
          : `${BACKGROUND_LOCATION_DISCLOSURE} On the next screen, choose "Allow all the time". Without it, recording stops when you lock your phone or switch apps.`,
        action: 'Continue',
      };
    case 'background-blocked':
      return {
        title: 'Allow location all the time',
        body: ios
          ? `${BACKGROUND_LOCATION_DISCLOSURE} To keep recording with the screen locked, open Settings, tap Location and choose "Always".`
          : `${BACKGROUND_LOCATION_DISCLOSURE} To keep recording with the screen locked, open Settings → Permissions → Location and choose "Allow all the time".`,
        action: 'Open Settings',
      };
  }
}

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
  const copy = locationAccessCopy(access);

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
