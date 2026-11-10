import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Plus, X } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { MAX_PHOTOS, type PickedPhoto } from './pick-photos';

const TILE = 78;

/**
 * The design's Photos row: a square for each picked photo with an × to take
 * it out, then a dashed Add square until there are four.
 */
export function PhotoStrip({
  photos,
  onAdd,
  onRemove,
  disabled,
}: {
  photos: readonly PickedPhoto[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  disabled: boolean;
}) {
  const colors = useColors();

  return (
    <View style={styles.block}>
      <Text variant="small" style={styles.label}>
        Photos
      </Text>
      <View style={styles.row}>
        {photos.map((photo, index) => (
          <View key={photo.uri} style={[styles.tile, { backgroundColor: colors.tint }]}>
            <Image source={{ uri: photo.uri }} style={styles.image} contentFit="cover" />
            <Pressable
              onPress={() => onRemove(index)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              hitSlop={8}
              style={[styles.remove, { backgroundColor: colors.glass }]}>
              <X size={12} color={colors.text} />
            </Pressable>
          </View>
        ))}
        {photos.length < MAX_PHOTOS && (
          <Pressable
            onPress={onAdd}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Add photos"
            style={({ pressed }) => [
              styles.tile,
              styles.add,
              {
                borderColor: colors.line3,
                backgroundColor: pressed ? colors.hover : 'transparent',
              },
            ]}>
            <Plus size={20} color={colors.accentHi} />
            <Text variant="label" color="muted" style={styles.addLabel}>
              Add
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 10,
  },
  label: {
    fontFamily: fonts.sans[500],
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 10,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addLabel: {
    fontSize: 11,
  },
});
