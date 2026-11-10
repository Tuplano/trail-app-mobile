import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/errors';
import { PaperPlaneRight, X } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { uuidv7 } from '@/db/ids';
import { initials } from '@/features/profile/validation';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { useAddComment, useComments } from './feed-api';
import { formatTimeAgo } from './feed-format';

/** The API's limit on a comment. */
const MAX_COMMENT_LENGTH = 1000;

/** The post whose comments are open: for the sheet's title, "Comments · 3" / "Jonas Berg · Eagle Point". */
export type CommentsFor = { postId: string; count: number; author: string; hike: string };

/**
 * A post's comments in a sheet from the bottom, as in the design: the list
 * (oldest first, more load on scrolling), and a field to add one. Needs
 * signal: offline it says so instead of sending.
 */
export function CommentsSheet({ post, onClose }: { post: CommentsFor; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const online = useSyncStatusStore((s) => s.online) !== false;
  const comments = useComments(post.postId);
  const add = useAddComment(post.postId);
  const [draft, setDraft] = useState('');
  // Kept until the comment is sent, so a retry of the same text reuses it.
  const [commentId, setCommentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "3h ago" is worked out from when the sheet opened.
  const [now] = useState(() => Date.now());

  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];
  const ready = draft.trim().length > 0 && !add.isPending;

  const send = () => {
    const body = draft.trim();
    if (!body || add.isPending) return;
    if (!online) {
      setError("No signal. Try again when you're back online.");
      return;
    }
    setError(null);
    const id = commentId ?? uuidv7();
    setCommentId(id);
    add.mutate(
      { id, body },
      {
        onSuccess: () => {
          setDraft('');
          setCommentId(null);
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* The dim layer is behind everything, so no gap shows the screen undimmed. */}
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.scrim }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close comments" />
        <View
          style={[styles.sheet, { backgroundColor: colors.sheet, borderTopColor: colors.line }]}>
          <View style={[styles.grabber, { backgroundColor: colors.line3 }]} />
          <View style={[styles.header, { borderBottomColor: colors.line2 }]}>
            <View style={styles.headerText}>
              <Text variant="subheading">Comments · {Math.max(post.count, items.length)}</Text>
              <Text variant="label" color="muted2" numberOfLines={1}>
                {post.author} · {post.hike}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.close, { backgroundColor: colors.surface }]}>
              <X size={16} color={colors.text} />
            </Pressable>
          </View>

          <FlatList
            data={items}
            keyExtractor={(c) => c.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            onEndReached={() => comments.hasNextPage && comments.fetchNextPage()}
            ListEmptyComponent={
              comments.isPending ? (
                <ActivityIndicator color={colors.accent} />
              ) : comments.isError ? (
                <Text variant="small" color="muted2" style={styles.empty}>
                  {online
                    ? "Couldn't load the comments."
                    : 'No signal. Comments load when you’re back online.'}
                </Text>
              ) : (
                <Text variant="small" color="muted2" style={styles.empty}>
                  No comments yet. Start the conversation.
                </Text>
              )
            }
            renderItem={({ item }) => (
              <View style={styles.comment}>
                <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
                  <Text style={[styles.initials, { color: colors.accentText }]}>
                    {initials(item.author.displayName)}
                  </Text>
                </View>
                <View style={styles.commentText}>
                  <View style={styles.commentMeta}>
                    <Text variant="small" style={styles.commentName}>
                      {item.author.displayName}
                    </Text>
                    <Text variant="label" color="muted3">
                      {formatTimeAgo(Date.parse(item.createdAt), now)}
                    </Text>
                  </View>
                  <Text variant="small" color="text2" style={styles.commentBody}>
                    {item.body}
                  </Text>
                </View>
              </View>
            )}
          />

          {error ? (
            <Text variant="label" color="err" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <View
            style={[
              styles.compose,
              { borderTopColor: colors.line2, paddingBottom: Math.max(insets.bottom, 14) + 10 },
            ]}>
            <TextInput
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                setCommentId(null); // different text: a new comment
              }}
              placeholder="Add a comment…"
              placeholderTextColor={colors.faint}
              selectionColor={colors.accent}
              accessibilityLabel="Add a comment"
              maxLength={MAX_COMMENT_LENGTH}
              returnKeyType="send"
              onSubmitEditing={send}
              style={[
                styles.input,
                { borderColor: colors.line, backgroundColor: colors.surface, color: colors.text },
              ]}
            />
            <Pressable
              onPress={send}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityLabel="Send comment"
              style={[styles.send, { borderColor: ready ? colors.accent : colors.line }]}>
              {add.isPending ? (
                <ActivityIndicator size="small" color={colors.accentText} />
              ) : (
                <PaperPlaneRight
                  size={18}
                  weight="fill"
                  color={ready ? colors.accentText : colors.faint}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  sheet: {
    maxHeight: '72%',
    minHeight: '40%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    // Fills the sheet between the header and the field, scrolling when full.
    flexGrow: 1,
    flexShrink: 1,
  },
  listContent: {
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 20,
  },
  comment: {
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: fonts.sans[600],
    fontSize: 11,
  },
  commentText: {
    flex: 1,
    gap: 3,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  commentName: {
    fontFamily: fonts.sans[500],
  },
  commentBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  compose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 14,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    fontFamily: fonts.sans[400],
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
