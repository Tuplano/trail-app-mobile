import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';

import { DownloadSimple } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { importGpx } from './import-gpx';

/**
 * "Import" at the top of History (not in the design): pick a .gpx file from
 * another app, and it becomes a hike here. On success the new hike opens;
 * a file that can't be imported gets a short note saying why.
 */
export function ImportGpxButton({ onImported }: { onImported?: () => void }) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true);
    importGpx()
      .then((result) => {
        if (result.kind === 'imported') {
          onImported?.();
          router.push({ pathname: '/hikes/[id]', params: { id: result.hikeId } });
        } else if (result.kind === 'problem') {
          Alert.alert("Couldn't import this file", result.message);
        }
      })
      .catch((error: unknown) => {
        console.warn('GPX import failed', error);
        Alert.alert("Couldn't import this file", 'Something went wrong. Please try again.');
      })
      .finally(() => setBusy(false));
  };

  return (
    <Pressable
      onPress={run}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Import a hike from a GPX file"
      accessibilityState={{ busy }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { borderColor: colors.line, backgroundColor: pressed ? colors.hover : 'transparent' },
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={colors.accentHi} />
      ) : (
        <DownloadSimple size={16} color={colors.accentHi} />
      )}
      <Text style={styles.label} color="text2">
        Import
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  label: {
    fontFamily: fonts.sans[500],
    fontSize: 14,
  },
});
