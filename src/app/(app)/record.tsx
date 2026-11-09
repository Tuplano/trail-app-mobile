import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { LiveStats } from '@/features/record/live-stats';
import { LiveTrackMap } from '@/features/record/live-track-map';
import { LocationAccessCard } from '@/features/record/location-access-card';
import { useLocationAccess } from '@/features/record/use-location-access';
import { useNow } from '@/features/record/use-now';
import { useLiveTrackStore } from '@/tracking/live-track-store';
import { LocationPermissionError } from '@/tracking/location-permission';
import { type RecorderStatus, useRecorderStore } from '@/tracking/recorder-store';
import { useColors } from '@/theme/use-colors';

const COPY: Record<RecorderStatus, { title: string; body: string }> = {
  idle: {
    title: 'Ready',
    body: 'Start when you reach the trailhead. Hikes save to your phone, so no signal is needed.',
  },
  recording: { title: 'Recording', body: 'Your hike is being recorded.' },
  paused: { title: 'Paused', body: 'Resume when you set off again, or finish the hike.' },
  finished: { title: 'Hike saved', body: 'Saved on this phone. It uploads once you have signal.' },
};

export default function RecordScreen() {
  const colors = useColors();
  const status = useRecorderStore((s) => s.status);
  const saving = useRecorderStore((s) => s.saving);
  const startedAt = useRecorderStore((s) => s.startedAt);
  const endedAt = useRecorderStore((s) => s.endedAt);
  const stats = useLiveTrackStore((s) => s.stats);
  const path = useLiveTrackStore((s) => s.path);
  const location = useLocationAccess();
  // Elapsed time includes pauses, like a stopwatch started at the trailhead.
  const now = useNow(status === 'recording' || status === 'paused');
  const elapsedS = startedAt ? ((endedAt ?? now) - startedAt) / 1000 : 0;
  const [error, setError] = useState<string | null>(null);
  const { start, pause, resume, finish, reset } = useRecorderStore.getState();

  const run = (action: () => Promise<void>) => () => {
    setError(null);
    action().catch((e: unknown) => {
      if (e instanceof LocationPermissionError) {
        // Access changed since the last check: show the card for the new state.
        location.refresh();
        return;
      }
      console.warn('Recorder change failed', e);
      setError("Couldn't save that change. Please try again.");
    });
  };

  const live = status === 'recording';
  // Starting or resuming needs full location access. Until then, the card
  // takes the place of the Start/Resume button and walks through each step.
  const { access } = location;
  const canGo = access === 'ready';
  const missingAccess =
    (status === 'idle' || status === 'paused') && access !== null && access !== 'ready'
      ? access
      : null;

  return (
    // No scrolling: the map fills the free space, and maps fight scroll views over drags.
    <Screen edges={['top']} contentStyle={styles.page} scroll={false}>
      <Text variant="title">Record</Text>

      <View style={styles.status} accessibilityLiveRegion="polite">
        <View style={styles.statusRow}>
          <View
            style={[styles.dot, { backgroundColor: live ? colors.accent : colors.line3 }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text variant="heading">{COPY[status].title}</Text>
        </View>
        <Text color="muted">{COPY[status].body}</Text>
      </View>

      {status !== 'idle' && (
        <LiveTrackMap path={path} live={status === 'recording' || status === 'paused'} />
      )}
      {status !== 'idle' && <LiveStats stats={stats} elapsedS={elapsedS} />}

      <View style={styles.actions}>
        {missingAccess && (
          <LocationAccessCard
            access={missingAccess}
            fixing={location.fixing}
            onFix={location.fix}
          />
        )}
        <FormError message={error} />
        {status === 'idle' && !missingAccess && (
          <Button
            label="Start hike"
            onPress={run(start)}
            loading={saving}
            disabled={!canGo}
          />
        )}
        {status === 'recording' && (
          <Button label="Pause" variant="secondary" onPress={run(pause)} disabled={saving} />
        )}
        {status === 'paused' && !missingAccess && (
          <Button label="Resume" onPress={run(resume)} disabled={saving || !canGo} />
        )}
        {(status === 'recording' || status === 'paused') && (
          <Button
            label="Finish hike"
            variant={missingAccess ? 'secondary' : 'primary'}
            onPress={run(finish)}
            loading={saving}
          />
        )}
        {status === 'finished' && <Button label="Done" onPress={reset} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  status: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
});
