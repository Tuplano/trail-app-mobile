import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { FormError } from '@/components/ui/form-error';
import { CloudSlash, Info } from '@/components/ui/icons';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import type { HikeVisibility } from '@/db/hikes';
import { useHikeDetail } from '@/features/history/use-hikes';
import { HikePostCard } from '@/features/posts/hike-post-card';
import { MAX_PHOTOS, pickPhotos, type PickedPhoto } from '@/features/posts/pick-photos';
import { PhotoStrip } from '@/features/posts/photo-strip';
import { PrivacyZonesRow } from '@/features/posts/privacy-zones-row';
import { MAX_CAPTION_LENGTH, shareHike } from '@/features/posts/share-hike';
import { VisibilityPicker } from '@/features/posts/visibility-picker';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * "New post", as in the design: share a finished hike with photos, a caption
 * and who can see it. Opens over the tabs. Post saves it on the phone and
 * goes to the feed; it uploads by itself, offline included.
 */
export default function NewPostScreen() {
  const colors = useColors();
  const { hikeId } = useLocalSearchParams<{ hikeId: string }>();
  const detail = useHikeDetail(hikeId);
  const online = useSyncStatusStore((s) => s.online) !== false;
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<HikeVisibility>('public');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPhotos = async () => {
    setError(null);
    try {
      const picked = await pickPhotos(MAX_PHOTOS - photos.length);
      setPhotos((current) => [...current, ...picked.photos].slice(0, MAX_PHOTOS));
      setError(picked.message);
    } catch (e) {
      console.warn('Photo picker failed', e);
      setError("Couldn't open your photos. Please try again.");
    }
  };

  const post = async () => {
    if (!hikeId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await shareHike({ hikeId, caption, visibility, photos });
      router.navigate('/feed');
    } catch (e) {
      console.warn('Could not save the post', e);
      setError("Couldn't save the post. Please try again.");
      setBusy(false);
    }
  };

  const ready = detail.state === 'ready';

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.page}>
      <View style={styles.header}>
        {/* Centred on the whole row, whatever the buttons' widths; it never takes their taps. */}
        <View pointerEvents="none" style={styles.headerTitle}>
          <Text variant="subheading">New post</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.cancel}>
          <Text color="muted">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={post}
          disabled={!ready || busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready || busy, busy }}
          style={({ pressed }) => [
            styles.postButton,
            { borderColor: colors.accent, backgroundColor: pressed ? colors.tint : 'transparent' },
          ]}>
          {busy ? (
            <ActivityIndicator size="small" color={colors.accentText} />
          ) : (
            <Text variant="small" color="accentText" style={styles.postLabel}>
              Post
            </Text>
          )}
        </Pressable>
      </View>

      {detail.state === 'loading' && <ActivityIndicator color={colors.accent} />}
      {(detail.state === 'missing' || detail.state === 'failed') && (
        <Text color="muted">
          {detail.state === 'missing'
            ? 'This hike is no longer on this phone.'
            : "Couldn't open this hike. Go back and try again."}
        </Text>
      )}

      {ready && (
        <>
          <HikePostCard hike={detail.hike} path={detail.path} />
          <PhotoStrip
            photos={photos}
            onAdd={addPhotos}
            onRemove={(index) => setPhotos((current) => current.filter((_, i) => i !== index))}
            disabled={busy}
          />
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="How was the trail?"
            placeholderTextColor={colors.faint}
            selectionColor={colors.accent}
            accessibilityLabel="Caption"
            multiline
            maxLength={MAX_CAPTION_LENGTH}
            editable={!busy}
            textAlignVertical="top"
            style={[
              styles.caption,
              { borderColor: colors.line, backgroundColor: colors.surface, color: colors.text },
            ]}
          />
          <VisibilityPicker value={visibility} onChange={setVisibility} disabled={busy} />
          <PrivacyZonesRow />
          <View style={styles.note}>
            {online ? (
              <Info size={15} color={colors.accentHi} />
            ) : (
              <CloudSlash size={15} color={colors.accentHi} />
            )}
            <Text variant="label" color="muted2" style={styles.noteText}>
              {online
                ? 'Photos upload on any connection.'
                : 'No signal. Your post is saved and will publish with its photos once you are back online.'}
            </Text>
          </View>
          <FormError message={error} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  cancel: {
    height: 40,
    justifyContent: 'center',
    minWidth: 64,
  },
  headerTitle: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButton: {
    height: 34,
    minWidth: 64,
    paddingHorizontal: 16,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postLabel: {
    fontFamily: fonts.sans[500],
    fontSize: 14,
  },
  caption: {
    minHeight: 92,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    fontFamily: fonts.sans[400],
    fontSize: 15,
    lineHeight: 22,
  },
  note: {
    flexDirection: 'row',
    gap: 8,
  },
  noteText: {
    flex: 1,
    lineHeight: 18,
  },
});
