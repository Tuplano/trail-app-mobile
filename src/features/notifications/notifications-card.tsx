import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Bell } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * The design's "Notifications · Optional" card, offering the phone's Allow
 * prompt. Optional, so "Not now" hides it until the app restarts; once the
 * hiker has answered the prompt it doesn't come back.
 */
export function NotificationsCard({
  asking,
  onAllow,
  onDismiss,
}: {
  asking: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      <View style={styles.heading}>
        <View style={[styles.iconTile, { backgroundColor: colors.tint }]}>
          <Bell size={20} color={colors.accentHi} />
        </View>
        <View style={styles.titles}>
          <Text variant="subheading">Notifications</Text>
          <Text variant="label" color="muted2">
            Optional
          </Text>
        </View>
      </View>
      <Text variant="small" color="muted">
        Get told when you earn a badge or reach a new level.
      </Text>
      <View style={styles.buttons}>
        <Button label="Allow notifications" onPress={onAllow} loading={asking} />
        <Button label="Not now" variant="secondary" onPress={onDismiss} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // The design's 40px rounded square behind the bell.
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  buttons: {
    gap: 10,
  },
});
