import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ArrowClockwise } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { useRecorderStore } from '@/tracking/recorder-store';
import { useColors } from '@/theme/use-colors';

import { APP_VERSION, storeUrl, storeWebUrl, useAppUpdateStore } from './app-update';

/**
 * The page over the whole app once the API says this version is too old
 * (426). Not in the design; laid out like its notices. The API won't take
 * anything from this version, so there's no way past it except a hike being
 * recorded right now: that one can be finished first (it's saved on the
 * phone and uploads after the update).
 */
export function UpdateRequired() {
  const colors = useColors();
  const required = useAppUpdateStore((s) => s.required);
  const hidden = useAppUpdateStore((s) => s.hidden);
  const recorder = useRecorderStore((s) => s.status);
  if (!required || hidden) return null;

  const hikeInProgress = recorder === 'recording' || recorder === 'paused';
  const url = storeUrl();
  const open = () => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      const web = storeWebUrl();
      if (web) Linking.openURL(web).catch(() => {});
    });
  };

  return (
    <SafeAreaView style={[StyleSheet.absoluteFill, styles.page, { backgroundColor: colors.bg }]}>
      <View style={styles.body}>
        <View style={[styles.icon, { backgroundColor: colors.tint }]}>
          <ArrowClockwise size={30} color={colors.accentHi} />
        </View>
        <Text variant="title" style={styles.center}>
          Update Trailing
        </Text>
        <Text color="muted" style={styles.center}>
          This version is too old to sync. Update to keep uploading hikes and using the feed. Your
          saved hikes are safe on this phone and upload after you update.
        </Text>
      </View>

      <View style={styles.actions}>
        {url ? (
          <Button label="Update in the store" onPress={open} />
        ) : (
          <Text variant="small" color="muted2" style={styles.center}>
            Get the new version from the store you installed Trailing from.
          </Text>
        )}
        {hikeInProgress ? (
          <Button
            label="Finish my hike first"
            variant="secondary"
            onPress={() => {
              useAppUpdateStore.getState().hide();
              router.navigate('/record');
            }}
          />
        ) : null}
        <Text variant="mono" color="faint" style={styles.center}>
          {`VERSION ${APP_VERSION}${required.minVersion ? ` · NEEDS ${required.minVersion}` : ''}`}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    gap: 12,
  },
});
