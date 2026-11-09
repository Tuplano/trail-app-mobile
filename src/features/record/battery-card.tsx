import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { currentBrand, openBatterySettings } from '@/tracking/battery-optimization';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { batteryTips } from './battery-tips';

/**
 * Asks Android users to stop the phone limiting Trail in the background, with
 * steps for their phone's brand. Optional: "Not now" hides it until the app
 * restarts, and it disappears by itself once the setting is changed.
 */
export function BatteryCard({ onDismiss }: { onDismiss: () => void }) {
  const colors = useColors();
  const [opening, setOpening] = useState(false);
  const brand = currentBrand();
  const { steps, moreHelpUrl } = batteryTips(brand);

  const open = () => {
    setOpening(true);
    openBatterySettings(brand)
      .catch((error: unknown) => console.warn('Could not open battery settings', error))
      .finally(() => setOpening(false));
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      <View style={styles.text}>
        <Text variant="subheading">Keep recording reliable</Text>
        <Text variant="small" color="muted">
          To save battery, your phone may stop Trail in the background and cut a hike short. In the
          settings that open:
        </Text>
        {steps.map((step, i) => (
          <Text key={step} variant="small" color="muted">
            {`${i + 1}. ${step}`}
          </Text>
        ))}
        <Text
          variant="small"
          color="accent"
          accessibilityRole="link"
          onPress={() => Linking.openURL(moreHelpUrl)}>
          More help for your phone
        </Text>
      </View>
      <View style={styles.buttons}>
        <Button label="Open battery settings" onPress={open} loading={opening} />
        <Button label="Not now" variant="secondary" onPress={onDismiss} />
      </View>
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
  buttons: {
    gap: 10,
  },
});
