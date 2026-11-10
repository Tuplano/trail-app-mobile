import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/** Shown in place of the list before the first hike is finished. */
export function HikeHistoryEmpty() {
  return (
    <View style={styles.empty}>
      <Text variant="heading">No hikes yet</Text>
      <Text color="muted">
        Finished hikes show up here, even before they upload. Record one when you reach the
        trailhead.
      </Text>
      <Button label="Record a hike" onPress={() => router.navigate('/record')} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    gap: 12,
    paddingTop: 8,
  },
});
