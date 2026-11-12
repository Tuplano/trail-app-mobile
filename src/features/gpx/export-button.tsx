import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';

import { Export } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import type { Hike } from '@/db/hikes';
import { useColors } from '@/theme/use-colors';

import { exportHikeGpx } from './export-gpx';

/**
 * The design's "GPX" button beside Share on a hike: saves or sends the
 * hike's track as a GPX file through the phone's share sheet.
 */
export function ExportGpxButton({ hike, style }: { hike: Hike; style?: object }) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true);
    exportHikeGpx(hike)
      .catch((error: unknown) => {
        console.warn('GPX export failed', error);
        Alert.alert("Couldn't export this hike", 'Something went wrong. Please try again.');
      })
      .finally(() => setBusy(false));
  };

  return (
    <Pressable
      onPress={run}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Export as a GPX file"
      accessibilityState={{ busy }}
      style={({ pressed }) => [
        styles.button,
        { borderColor: colors.line, backgroundColor: pressed ? colors.line2 : 'transparent' },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <Export size={17} color={colors.text} />
      )}
      <Text>GPX</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // As in the design: the same height and roundness as Share, a plain outline.
  button: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
