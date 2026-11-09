import { StyleSheet } from 'react-native';

import { BrandMark } from '@/components/ui/brand-mark';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/auth-store';
import { ApiStatusCard } from '@/features/health/api-status-card';
import { SyncStatusCard } from '@/features/sync/sync-status-card';

/** Placeholder home: the hike history replaces it in Stage 4. */
export default function HomeScreen() {
  const displayName = useAuthStore((s) => s.user?.displayName);

  return (
    <Screen edges={['top']} contentStyle={styles.page}>
      <BrandMark />
      <Text variant="title" style={styles.greeting}>
        {displayName ? `Hi, ${displayName}.` : 'Welcome.'}
      </Text>
      <SyncStatusCard />
      <ApiStatusCard />
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
  greeting: {
    marginTop: 8,
  },
});
