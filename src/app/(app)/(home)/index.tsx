import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/ui/brand-mark';
import { FormError } from '@/components/ui/form-error';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/auth-store';
import { HikeHistoryEmpty } from '@/features/history/hike-history-empty';
import { HikeListItem } from '@/features/history/hike-list-item';
import { useHikeHistory } from '@/features/history/use-hikes';
import { SyncStatusCard } from '@/features/sync/sync-status-card';
import { useColors } from '@/theme/use-colors';

/**
 * Home: the hike history. Read from the phone, so it works offline and shows
 * hikes that haven't uploaded yet.
 */
export default function HomeScreen() {
  const colors = useColors();
  const displayName = useAuthStore((s) => s.user?.displayName);
  const { hikes, failed } = useHikeHistory();

  const header = (
    <View style={styles.header}>
      <BrandMark />
      <Text variant="title" style={styles.greeting}>
        {displayName ? `Hi, ${displayName}.` : 'Welcome.'}
      </Text>
      <SyncStatusCard />
      {hikes && hikes.length > 0 && <Text variant="heading">Your hikes</Text>}
      <FormError
        message={failed ? "Couldn't load your hikes. Leave and come back to try again." : null}
      />
    </View>
  );

  return (
    // A FlatList rather than <Screen>'s ScrollView: it only draws the rows on
    // screen, so a long history stays smooth.
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <FlatList
        data={hikes ?? []}
        keyExtractor={(hike) => hike.id}
        renderItem={({ item }) => <HikeListItem hike={item} />}
        ListHeaderComponent={header}
        // Wait for the first read, so "No hikes yet" doesn't flash before the list.
        ListEmptyComponent={hikes ? <HikeHistoryEmpty /> : undefined}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  page: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    gap: 24,
    paddingBottom: 16,
  },
  greeting: {
    marginTop: 8,
  },
  separator: {
    height: 12,
  },
});
