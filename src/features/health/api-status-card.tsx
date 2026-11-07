import { StyleSheet } from 'react-native';

import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { env } from '@/config/env';
import { Spacing } from '@/constants/theme';

import { useApiHealth } from './use-api-health';

/** Temporary Stage 1 check: proves the app can reach the API. */
export function ApiStatusCard() {
  const { data, error, isPending } = useApiHealth();

  let status = 'checking…';
  if (data) status = data.status;
  else if (error) status = 'unreachable';

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">API</ThemedText>
      <HintRow title="URL" hint={env.apiUrl} />
      <HintRow title="Environment" hint={env.appEnv} />
      <HintRow title="Status" hint={status} />
      {data && (
        <>
          <HintRow title="Database" hint={data.checks.database} />
          <HintRow title="Redis" hint={data.checks.redis} />
        </>
      )}
      {!isPending && error && (
        <ThemedText type="small" themeColor="textSecondary">
          {error.message}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
