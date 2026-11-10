import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { MapTrifold, Pause, Play, Stop } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { hikeTitle } from '@/features/history/hike-summary';
import { BatteryCard } from '@/features/record/battery-card';
import { FinishPanel } from '@/features/record/finish-panel';
import { formatClock } from '@/features/record/format';
import { LiveTrackMap } from '@/features/record/live-track-map';
import { LocationAccessCard } from '@/features/record/location-access-card';
import { MapChips } from '@/features/record/map-chips';
import { RecordStatsList, RecordStatsRow } from '@/features/record/record-stats';
import { RecorderStatusLine } from '@/features/record/recorder-status';
import { useBatteryOptimization } from '@/features/record/use-battery-optimization';
import { useLocationAccess } from '@/features/record/use-location-access';
import { useNow } from '@/features/record/use-now';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { useLiveTrackStore } from '@/tracking/live-track-store';
import { LocationPermissionError } from '@/tracking/location-permission';
import { useRecorderStore } from '@/tracking/recorder-store';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/** How far the bottom panel reaches up over the map, as in the design. */
const SHEET_OVERLAP = 18;

/** Shown when the hike was picked back up after the app closed. */
const RESTORED_NOTE = {
  recording: 'The app closed during your hike, so recording picked up where it left off.',
  paused: 'The app closed during your hike. Resume when you set off again, or finish it.',
} as const;

/**
 * The recorder, laid out as in the design. Two layouts the hiker can switch
 * between: the map filling the screen with the numbers in a panel below, or
 * big numbers with a small map. After Finish, the panel asks for a name and
 * whether to save or discard the hike.
 */
export default function RecordScreen() {
  const colors = useColors();
  const status = useRecorderStore((s) => s.status);
  const saving = useRecorderStore((s) => s.saving);
  const startedAt = useRecorderStore((s) => s.startedAt);
  const endedAt = useRecorderStore((s) => s.endedAt);
  const restored = useRecorderStore((s) => s.restored);
  const stats = useLiveTrackStore((s) => s.stats);
  const path = useLiveTrackStore((s) => s.path);
  const accuracyM = useLiveTrackStore((s) => s.accuracyM);
  const online = useSyncStatusStore((s) => s.online);
  const location = useLocationAccess();
  const batteryOptimized = useBatteryOptimization();
  const [batteryDismissed, setBatteryDismissed] = useState(false);
  const [layout, setLayout] = useState<'map' | 'stats'>('map');
  const [error, setError] = useState<string | null>(null);
  const { start, pause, resume, finish, save, discard } = useRecorderStore.getState();

  // Elapsed time includes pauses, like a stopwatch started at the trailhead.
  const now = useNow(status === 'recording' || status === 'paused');
  const elapsedS = startedAt ? ((endedAt ?? now) - startedAt) / 1000 : 0;

  const run = (action: () => Promise<void>, after?: () => void) => () => {
    setError(null);
    action()
      .then(after)
      .catch((e: unknown) => {
        if (e instanceof LocationPermissionError) {
          // Access changed since the last check: show the card for the new state.
          location.refresh();
          return;
        }
        console.warn('Recorder change failed', e);
        setError("Couldn't save that change. Please try again.");
      });
  };

  const finished = status === 'finished';
  // Starting or resuming needs full location access. Until then, the card
  // takes the place of the Start/Resume button and walks through each step.
  const { access } = location;
  const canGo = access === 'ready';
  const missingAccess =
    (status === 'idle' || status === 'paused') && access !== null && access !== 'ready'
      ? access
      : null;
  // Battery advice is optional, so it never blocks Start. It waits until
  // location is sorted, so only one card shows at a time.
  const showBatteryCard =
    status === 'idle' && canGo && batteryOptimized === true && !batteryDismissed;
  // Before Start and while recording the map follows the hiker; once
  // finished it frames the whole track.
  const map = (
    <LiveTrackMap
      path={path}
      live={!finished}
      style={layout === 'map' ? styles.fullMap : styles.miniMap}
      // The bottom panel overlaps the full map by 18.
      bottomInset={layout === 'map' ? SHEET_OVERLAP : 0}
    />
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      {/* Keeps the hike name field above the keyboard after Finish. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {layout === 'map' ? (
          <View style={styles.flex}>
            {map}
            <MapChips
              accuracyM={status === 'recording' ? accuracyM : null}
              offline={online === false}
              onShowStats={() => setLayout('stats')}
            />
          </View>
        ) : (
          <View style={[styles.flex, styles.statsPage]}>
            <View style={styles.statusRow}>
              <RecorderStatusLine status={status} />
              <Pressable
                onPress={() => setLayout('map')}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.mapToggle,
                  {
                    borderColor: colors.line,
                    backgroundColor: pressed ? colors.hover : 'transparent',
                  },
                ]}>
                <MapTrifold size={16} color={colors.accentHi} />
                <Text variant="label">Map view</Text>
              </Pressable>
            </View>
            <View style={styles.clockBlock}>
              <Text variant="label" color="muted2" style={styles.caps}>
                TIME
              </Text>
              <Text style={styles.hugeClock}>{formatClock(elapsedS)}</Text>
            </View>
            <RecordStatsList stats={stats} />
            {map}
          </View>
        )}

        {/* The panel at the bottom, overlapping the map's lower edge. */}
        <View style={[styles.sheet, { backgroundColor: colors.sheet, borderTopColor: colors.line }]}>
          {finished ? (
            <FinishPanel
              // A new hike gets a fresh panel (and name field).
              key={startedAt ?? 'none'}
              defaultTitle={hikeTitle({ title: null, startedAt: startedAt ?? now })}
              stats={stats}
              online={online !== false}
              saving={saving}
              error={error}
              onSave={(title) => run(() => save(title), () => router.navigate('/'))()}
              onDiscard={run(discard)}
            />
          ) : (
            <>
              {layout === 'map' && (
                <>
                  <View style={styles.statusRow}>
                    <RecorderStatusLine status={status} />
                    {status !== 'idle' && (
                      <Text style={[styles.points, { color: colors.muted3 }]}>
                        {stats.pointCount} pts
                      </Text>
                    )}
                  </View>
                  <Text style={styles.clock}>{formatClock(elapsedS)}</Text>
                  <RecordStatsRow stats={stats} />
                </>
              )}
              {restored && (status === 'recording' || status === 'paused') && (
                <Text variant="small" color="muted">
                  {RESTORED_NOTE[status]}
                </Text>
              )}
              {missingAccess && (
                <LocationAccessCard
                  access={missingAccess}
                  fixing={location.fixing}
                  onFix={location.fix}
                />
              )}
              {showBatteryCard && <BatteryCard onDismiss={() => setBatteryDismissed(true)} />}
              <FormError message={error} />
              {status === 'idle' && !missingAccess && (
                <Button
                  label="Start hike"
                  icon={<Play size={18} weight="fill" color={colors.accentText} />}
                  onPress={run(start)}
                  loading={saving}
                  disabled={!canGo}
                  style={styles.bigButton}
                />
              )}
              {status === 'recording' && (
                <Button
                  label="Pause"
                  icon={<Pause size={18} weight="fill" color={colors.accentText} />}
                  onPress={run(pause)}
                  disabled={saving}
                  style={styles.bigButton}
                />
              )}
              {status === 'paused' && (
                <View style={styles.pair}>
                  {!missingAccess && (
                    <Button
                      label="Resume"
                      icon={<Play size={16} weight="fill" color={colors.accentText} />}
                      onPress={run(resume)}
                      disabled={saving || !canGo}
                      style={[styles.bigButton, styles.half]}
                    />
                  )}
                  <Button
                    label="Finish"
                    variant="secondary"
                    icon={<Stop size={16} weight="fill" color={colors.text} />}
                    onPress={run(finish)}
                    loading={saving}
                    style={[styles.bigButton, styles.half]}
                  />
                </View>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  fullMap: {
    flex: 1,
    minHeight: 0,
    borderRadius: 0,
    borderWidth: 0,
  },
  miniMap: {
    flex: 1,
    minHeight: 90,
  },
  statsPage: {
    gap: 14,
    paddingTop: 8,
    paddingHorizontal: 22,
    paddingBottom: 34,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mapToggle: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  clockBlock: {
    gap: 6,
  },
  caps: {
    fontSize: 11,
    letterSpacing: 0.66,
  },
  hugeClock: {
    fontFamily: fonts.sans[500],
    fontSize: 76,
    lineHeight: 76,
    letterSpacing: -3,
    fontVariant: ['tabular-nums'],
  },
  sheet: {
    marginTop: -SHEET_OVERLAP,
    gap: 16,
    paddingTop: 18,
    paddingHorizontal: 22,
    paddingBottom: 22,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
  },
  points: {
    fontFamily: fonts.mono[400],
    fontSize: 12,
  },
  clock: {
    fontFamily: fonts.sans[500],
    fontSize: 52,
    lineHeight: 54,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  bigButton: {
    height: 58,
    borderRadius: 29,
  },
  pair: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
});
