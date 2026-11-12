import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormError } from '@/components/ui/form-error';
import { Text } from '@/components/ui/text';
import { ImportGpxButton } from '@/features/gpx/import-button';
import { HikeHistoryEmpty } from '@/features/history/hike-history-empty';
import { HikeListItem } from '@/features/history/hike-list-item';
import { summarizeHistory } from '@/features/history/hike-summary';
import { OutboxStrip } from '@/features/history/outbox-strip';
import { useHikeHistory } from '@/features/history/use-hikes';
import { useColors } from '@/theme/use-colors';

/**
 * History: every finished hike, newest first, with how its upload is going.
 * Read from the phone, so it works offline and shows hikes not uploaded yet.
 * Import adds a hike from another app's GPX file.
 */
export default function HistoryScreen() {
  const colors = useColors();
  const { hikes, failed } = useHikeHistory();

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text variant="title" style={styles.title}>
            History
          </Text>
          {hikes && hikes.length > 0 && (
            <Text variant="small" color="muted2">
              {summarizeHistory(hikes)}
            </Text>
          )}
        </View>
        {/* Not in the design: brings in a hike from another app's GPX file. */}
        <ImportGpxButton />
      </View>
      <OutboxStrip />
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
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  header: {
    gap: 16,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 30, // the design's History title is a step above `title` (28)
    lineHeight: 36,
  },
  separator: {
    height: 16,
  },
});
