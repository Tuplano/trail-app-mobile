import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/auth-store';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { useApiHealth } from './use-api-health';

/** Temporary Stage 1 check: proves the app can reach the API. */
export function ApiStatusCard() {
  const colors = useColors();
  const { data, error, isPending } = useApiHealth();
  const authStatus = useAuthStore((s) => s.status);

  let status = 'checking…';
  if (data) status = data.status;
  else if (error) status = 'unreachable';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      <Text variant="subheading">API</Text>
      <Row label="URL" value={env.apiUrl} />
      <Row label="Environment" value={env.appEnv} />
      <Row label="Status" value={status} />
      <Row label="Session" value={authStatus} />
      {data && (
        <>
          <Row label="Database" value={data.checks.database} />
          <Row label="Redis" value={data.checks.redis} />
        </>
      )}
      {!isPending && error && (
        <Text variant="small" color="muted2">
          {error.message}
        </Text>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="small" color="muted">
        {label}
      </Text>
      <Text variant="small" style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
