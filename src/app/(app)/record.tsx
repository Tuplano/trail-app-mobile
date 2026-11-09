import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
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
  const [error, setError] = useState<string | null>(null);
  const { start, pause, resume, finish, reset } = useRecorderStore.getState();

  const run = (action: () => Promise<void>) => () => {
    setError(null);
    action().catch((e: unknown) => {
      console.warn('Recorder change failed', e);
      setError("Couldn't save that change. Please try again.");
    });
  };

  const live = status === 'recording';

  return (
    <Screen edges={['top']} contentStyle={styles.page}>
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

      <View style={styles.actions}>
        <FormError message={error} />
        {status === 'idle' && <Button label="Start hike" onPress={run(start)} loading={saving} />}
        {status === 'recording' && (
          <Button label="Pause" variant="secondary" onPress={run(pause)} disabled={saving} />
        )}
        {status === 'paused' && <Button label="Resume" onPress={run(resume)} disabled={saving} />}
        {(status === 'recording' || status === 'paused') && (
          <Button label="Finish hike" onPress={run(finish)} loading={saving} />
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
    gap: 24,
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
