import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Medal } from '@/features/achievements/medal';
import { type LadderStep, useTrackLadder } from '@/features/achievements/progress-api';
import {
  formatMetric,
  formatUnlockDate,
  stepTitle,
  trackProgress,
} from '@/features/achievements/progress-format';
import { formatCount } from '@/features/history/hike-summary';
import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * One track's ladder: the medal you hold, how far along you are, then every
 * step from Bronze up. Steps reached show when, and open the hike that
 * reached them; the next one shows the way there. Past Mythic the ladder
 * goes on as Prestige steps, one past where you are.
 */
export default function TrackLadderScreen() {
  const colors = useColors();
  const { track: code } = useLocalSearchParams<{ track: string }>();
  const ladder = useTrackLadder(code);

  if (!ladder.data) {
    return (
      <Screen edges={[]} contentStyle={styles.page}>
        {ladder.isError ? (
          <Text variant="small" color="muted2">
            This track shows when you’re back online.
          </Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </Screen>
    );
  }

  const { track, steps } = ladder.data;
  const progress = trackProgress(track);
  const reached = track.current?.step ?? 0;

  return (
    <Screen edges={[]} contentStyle={styles.page}>
      <View style={styles.hero}>
        <Medal
          rank={track.current?.rank?.code ?? null}
          icon={track.icon}
          size={112}
          prestige={track.current?.prestige ?? 0}
          progress={progress.fraction}
        />
        <Text variant="title">{track.name}</Text>
        <Text variant="subheading" style={{ color: colors.accentText }}>
          {progress.rank}
        </Text>
        <Text variant="small" color="muted" style={styles.center}>
          {track.description}
        </Text>
        <Text style={[styles.amount, { color: colors.text2 }]}>
          {formatMetric(track.metric, track.value)} · {progress.toGo}
        </Text>
      </View>

      <View style={styles.ladder}>
        {steps.map((step) => (
          <StepRow
            key={step.step}
            step={step}
            icon={track.icon}
            metric={track.metric}
            state={step.step <= reached ? 'reached' : step.step === reached + 1 ? 'next' : 'later'}
            fraction={progress.fraction}
          />
        ))}
      </View>
      <Text variant="label" color="muted3" style={styles.center}>
        After Mythic, every {formatMetric(track.metric, prestigeGap(steps, track.namedSteps))} more
        is one more Prestige. There’s no top.
      </Text>
    </Screen>
  );
}

/** How far apart Prestige steps are: the gap after the last named step. */
function prestigeGap(steps: readonly LadderStep[], named: number): number {
  const last = steps.find((s) => s.step === named);
  const after = steps.find((s) => s.step === named + 1);
  return last && after ? after.threshold - last.threshold : 0;
}

function StepRow({
  step,
  icon,
  metric,
  state,
  fraction,
}: {
  step: LadderStep;
  icon: string;
  metric: 'distance' | 'climb' | 'hikes' | 'active_weeks';
  state: 'reached' | 'next' | 'later';
  fraction: number;
}) {
  const colors = useColors();
  const hikeId = step.hikeId;
  const open = hikeId
    ? () => router.push({ pathname: '/hikes/[id]', params: { id: hikeId } })
    : undefined;
  const percent = `${Math.round(fraction * 1000) / 10}%` as const;

  return (
    <Pressable
      onPress={open}
      disabled={!open}
      accessibilityRole={open ? 'button' : undefined}
      accessibilityLabel={`${stepTitle(step)}, ${formatMetric(metric, step.threshold)}, ${
        state === 'reached' ? `reached ${formatUnlockDate(step.unlockedAt ?? '')}` : 'not reached'
      }`}
      style={({ pressed }) => [
        styles.step,
        {
          borderColor: state === 'next' ? colors.accent : colors.line2,
          backgroundColor: pressed ? colors.hover : state === 'next' ? colors.tint : colors.surface,
        },
      ]}>
      <View style={state === 'later' ? styles.dim : null}>
        <Medal
          rank={state === 'reached' ? (step.rank?.code ?? null) : null}
          icon={icon}
          size={44}
          prestige={state === 'reached' ? step.prestige : 0}
        />
      </View>
      <View style={styles.stepBody}>
        <View style={styles.stepTop}>
          <Text
            variant="bodyStrong"
            numberOfLines={1}
            style={[styles.flex, state === 'later' && { color: colors.muted3 }]}>
            {stepTitle(step)}
          </Text>
          <Text style={[styles.mono, { color: colors.muted2 }]}>
            {formatMetric(metric, step.threshold)}
          </Text>
        </View>
        {state === 'next' ? (
          <View style={[styles.bar, { backgroundColor: colors.line }]}>
            <View style={[styles.fill, { width: percent, backgroundColor: colors.accent }]} />
          </View>
        ) : null}
        <Text variant="label" color={state === 'later' ? 'faint' : 'muted2'}>
          {state === 'reached' && step.unlockedAt
            ? `Reached ${formatUnlockDate(step.unlockedAt)}`
            : state === 'next'
              ? 'Next'
              : 'Locked'}
          {step.xp > 0 ? ` · +${formatCount(step.xp)} XP` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 22,
  },
  hero: {
    alignItems: 'center',
    gap: 6,
  },
  center: {
    textAlign: 'center',
  },
  amount: {
    marginTop: 4,
    fontFamily: fonts.mono[400],
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  ladder: {
    gap: 8,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  dim: {
    opacity: 0.55,
  },
  stepBody: {
    flex: 1,
    gap: 6,
  },
  stepTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  mono: {
    fontFamily: fonts.mono[400],
    fontSize: 11,
    lineHeight: 15,
  },
  bar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
