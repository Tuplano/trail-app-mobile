import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MagnifyingGlass, XCircle } from '@/components/ui/icons';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { useUserSearch } from '@/features/people/people-api';
import { searchView } from '@/features/people/people-format';
import { PersonRow } from '@/features/people/person-row';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * Find people to follow, from the magnifier on the Feed. Not in the design:
 * its field looks like the app's text fields and the results like its
 * rounded lists. Searches by name, or by the start of a @username.
 */
export default function SearchScreen() {
  const colors = useColors();
  const [text, setText] = useState('');
  const search = useUserSearch(text);
  const online = useSyncStatusStore((s) => s.online) !== false;
  const people = search.data ?? [];
  const view = searchView({
    text,
    isPending: search.isPending || search.isFetching,
    isError: search.isError,
    count: people.length,
    online,
  });

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.top}>
        <Text variant="title">Find people</Text>
        <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <MagnifyingGlass size={18} color={colors.muted2} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Name or @username"
            placeholderTextColor={colors.faint}
            selectionColor={colors.accent}
            accessibilityLabel="Search people"
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.input, { color: colors.text }]}
          />
          {text.length > 0 && (
            <Pressable
              onPress={() => setText('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}>
              <XCircle size={18} weight="fill" color={colors.faint} />
            </Pressable>
          )}
        </View>
      </View>

      {view.kind === 'results' ? (
        <FlatList
          data={people}
          keyExtractor={(person) => person.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <PersonRow person={item} first={index === 0} last={index === people.length - 1} />
          )}
        />
      ) : view.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      ) : view.kind === 'none' ? (
        <Notice
          icon={MagnifyingGlass}
          title="No one found"
          body={`No hikers match “${view.query}”. Try a name or the start of a @username.`}
        />
      ) : view.kind === 'error' ? (
        <Notice
          icon={MagnifyingGlass}
          title={view.offline ? 'No signal' : "Couldn't search"}
          body={view.offline ? 'Search works when you’re back online.' : 'Tap below to try again.'}
          action={
            view.offline ? undefined : { label: 'Try again', onPress: () => search.refetch() }
          }
        />
      ) : (
        <Text color="muted2" style={styles.hint}>
          Type at least 2 letters of a name or @username.
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  top: {
    gap: 14,
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: radius.input,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.sans[400],
    fontSize: 15,
  },
  list: {
    paddingBottom: 24,
  },
  spinner: {
    marginVertical: 24,
  },
  hint: {
    paddingHorizontal: 22,
  },
});
