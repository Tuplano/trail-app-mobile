import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { MagnifyingGlass, MapPin, XCircle } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { type Place, searchView } from './place-search';
import { usePlaceSearch } from './use-place-search';

/**
 * A search box over a map: type a place (a mountain, a trailhead, a town),
 * pick it from the list, and the map moves there through `onPick`. Not in
 * the design; styled like the map's other floating labels.
 *
 * Place it inside the map's frame; it floats at the top.
 */
export function MapSearch({
  getNear,
  onPick,
  placeholder = 'Search a place',
  maxListHeight = 200,
}: {
  /** The map's center, [longitude, latitude]: nearer places are listed first. */
  getNear: () => [number, number] | null;
  onPick: (place: Place) => void;
  placeholder?: string;
  /** Keeps the list inside a small map. */
  maxListHeight?: number;
}) {
  const colors = useColors();
  const [query, setQuery] = useState('');
  // The list hides once a place is picked, until the text changes again.
  const [open, setOpen] = useState(false);
  const online = useSyncStatusStore((s) => s.online) !== false;
  const search = usePlaceSearch(query, getNear);
  const places = search.data ?? [];
  const view = searchView({
    query,
    isFetching: search.isFetching,
    isError: search.isError,
    count: places.length,
    online,
  });

  const pick = (place: Place) => {
    Keyboard.dismiss();
    setQuery(place.name);
    setOpen(false);
    onPick(place);
  };

  const clear = () => {
    setQuery('');
    setOpen(false);
  };

  const panel = { backgroundColor: colors.glass, borderColor: colors.line };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.field, panel]}>
        <MagnifyingGlass size={16} color={colors.muted2} />
        <TextInput
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          selectionColor={colors.accent}
          accessibilityLabel="Search a place on the map"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => places[0] && pick(places[0])}
          style={[styles.input, { color: colors.text }]}
        />
        {query.length > 0 && (
          <Pressable
            onPress={clear}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}>
            <XCircle size={18} weight="fill" color={colors.faint} />
          </Pressable>
        )}
      </View>

      {open && view.kind !== 'idle' ? (
        <View style={[styles.list, panel, { maxHeight: maxListHeight }]}>
          {view.kind === 'results' ? (
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {places.map((place, i) => (
                <Pressable
                  key={place.id}
                  onPress={() => pick(place)}
                  accessibilityRole="button"
                  accessibilityLabel={place.detail ? `${place.name}, ${place.detail}` : place.name}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: 1, borderTopColor: colors.line2 },
                    pressed && { backgroundColor: colors.hover },
                  ]}>
                  <MapPin size={16} color={colors.accentHi} />
                  <View style={styles.rowText}>
                    <Text variant="small" numberOfLines={1}>
                      {place.name}
                    </Text>
                    {place.detail ? (
                      <Text variant="label" color="muted2" numberOfLines={1}>
                        {place.detail}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : view.kind === 'loading' ? (
            <ActivityIndicator color={colors.accentHi} style={styles.message} />
          ) : (
            <Text variant="small" color="muted2" style={styles.message}>
              {view.kind === 'none'
                ? `No places match “${view.query}”.`
                : view.kind === 'offline'
                  ? 'Search needs signal. You can still move the map.'
                  : "Search isn't working right now. Move the map instead."}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    gap: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: radius.input,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sans[400],
    fontSize: 14,
    paddingVertical: 0,
  },
  list: {
    borderRadius: radius.input,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  rowText: {
    flex: 1,
  },
  message: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
});
