import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Path, Timer, TrendUp } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { formatCount, formatHikeDuration } from '@/features/history/hike-summary';
import type { HikeStats } from '@/tracking/hike-stats';
import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { formatKm } from './format';

type FinishPanelProps = {
  /** What the name field starts with, e.g. "Afternoon hike". */
  defaultTitle: string;
  stats: HikeStats;
  /** False while offline: the note then says the upload waits for signal. */
  online: boolean;
  saving: boolean;
  error: string | null;
  onSave: (title: string) => void;
  onDiscard: () => void;
};

/**
 * Shown after Finish, as in the design: name the hike, check its numbers,
 * then save it (it uploads) or discard it (it's deleted).
 */
export function FinishPanel({
  defaultTitle,
  stats,
  online,
  saving,
  error,
  onSave,
  onDiscard,
}: FinishPanelProps) {
  const colors = useColors();
  const [title, setTitle] = useState(defaultTitle);

  return (
    <View style={styles.panel}>
      <Text style={[styles.kicker, { color: colors.muted2 }]}>HIKE FINISHED</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        accessibilityLabel="Hike name"
        placeholder={defaultTitle}
        placeholderTextColor={colors.faint}
        selectionColor={colors.accent}
        returnKeyType="done"
        maxLength={120}
        style={[
          styles.input,
          { borderColor: colors.line, backgroundColor: colors.surface, color: colors.text },
        ]}
      />
      <View style={styles.stats}>
        <Stat icon={Path} value={`${formatKm(stats.distanceM)} km`} />
        <Stat icon={Timer} value={formatHikeDuration(stats.movingTimeS)} />
        <Stat icon={TrendUp} value={`${formatCount(stats.elevationGainM)} m`} />
      </View>
      <Text variant="small" color="muted2">
        {online
          ? 'Saved on this phone first, then uploaded.'
          : 'No signal. Saved on this phone; it uploads by itself once you are back online.'}
      </Text>
      <FormError message={error} />
      <View style={styles.actions}>
        <Button
          label="Discard"
          variant="secondary"
          onPress={onDiscard}
          disabled={saving}
          style={styles.discard}
        />
        <Button
          label="Save hike"
          onPress={() => onSave(title)}
          loading={saving}
          style={styles.save}
        />
      </View>
    </View>
  );
}

function Stat({ icon: Icon, value }: { icon: typeof Path; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.stat}>
      <Icon size={15} color={colors.accentHi} />
      <Text variant="small" color="text2" style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 14,
  },
  kicker: {
    fontFamily: fonts.mono[500],
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.88,
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.input,
    borderWidth: 1,
    fontFamily: fonts.sans[500],
    fontSize: 17,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  // The design's 1 : 2 split between Discard and Save.
  discard: {
    flex: 1,
  },
  save: {
    flex: 2,
  },
});
