import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Stripes } from '@/components/ui/stripes';
import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/** One photo of a post: a link (or file) to show, or null while the server is still resizing it. */
export type CarouselPhoto = { key: string; uri: string | null };

const HEIGHT = 230;

/**
 * A post's photos, as in the design: a 230-high rounded box. More than one
 * swipes sideways, with "1 / 3" in the corner. A photo not ready yet shows
 * the design's stripes with a label.
 */
export function PhotoCarousel({
  photos,
  postId,
}: {
  photos: readonly CarouselPhoto[];
  postId: string;
}) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  return (
    <View
      style={[styles.box, { borderColor: colors.line2 }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <FlatList
          data={photos}
          keyExtractor={(photo) => photo.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <View style={{ width, height: HEIGHT }}>
              {item.uri ? (
                <Image
                  source={{ uri: item.uri }}
                  style={styles.image}
                  contentFit="cover"
                  transition={150}
                  accessibilityLabel={`Photo ${i + 1} of ${photos.length}`}
                />
              ) : (
                <View style={styles.placeholder}>
                  <Stripes id={`photo-${postId}-${i}`} size={20} />
                  <Text style={[styles.mono, { color: colors.faint }]}>PHOTO PROCESSING</Text>
                </View>
              )}
            </View>
          )}
        />
      )}
      {photos.length > 1 && (
        <View style={[styles.count, { backgroundColor: colors.glass }]}>
          <Text style={[styles.mono, { color: colors.text2 }]}>
            {index + 1} / {photos.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: HEIGHT,
    marginHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mono: {
    fontFamily: fonts.mono[400],
    fontSize: 11,
    lineHeight: 14,
  },
  count: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
});
