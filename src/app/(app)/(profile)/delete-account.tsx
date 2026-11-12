import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Trash, Warning } from '@/components/ui/icons';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { countNotUploaded } from '@/db/account-data';
import { getDb } from '@/db/database';
import { deleteAccount } from '@/features/account/delete-account';
import {
  deleteBlocker,
  describeDeleteError,
  notUploadedWarning,
} from '@/features/account/delete-account-rules';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { useRecorderStore } from '@/tracking/recorder-store';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * Settings → Delete account. The design has the red row but no screen, so
 * this one is laid out like Settings: what goes, a warning about hikes only
 * this phone has, the password to confirm, and a red button with a last
 * "are you sure". Once the server has deleted the account, the phone's copy
 * is wiped and the app goes back to sign-in.
 */
export default function DeleteAccountScreen() {
  const colors = useColors();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const recorder = useRecorderStore((s) => s.status);
  const online = useSyncStatusStore((s) => s.online) !== false;
  const blocker = deleteBlocker({ recorder, online });

  // Re-counted each time the screen shows: an upload may have finished meanwhile.
  useFocusEffect(
    useCallback(() => {
      let current = true;
      getDb()
        .then(countNotUploaded)
        .then((counts) => {
          if (current) setWarning(notUploadedWarning(counts));
        })
        .catch((error: unknown) => console.warn('Could not count hikes not uploaded', error));
      return () => {
        current = false;
      };
    }, []),
  );

  const remove = () => {
    setBusy(true);
    deleteAccount(password).catch((error: unknown) => {
      const problem = describeDeleteError(error);
      setFieldError(problem.field);
      setFormError(problem.form);
      setBusy(false);
    });
    // On success the app is signed out and leaves this screen by itself.
  };

  const confirm = () => {
    setFieldError(null);
    setFormError(null);
    if (!password) {
      setFieldError('Enter your password.');
      return;
    }
    Alert.alert('Delete your account?', 'Everything in it is deleted for good.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  };

  return (
    // The header (with the back button) sits under the status bar already.
    <Screen edges={['bottom']} contentStyle={styles.page}>
      <View style={styles.heading}>
        <Text variant="title">Delete account</Text>
        <Text color="muted">
          This can&apos;t be undone. Your hikes and routes, posts, photos, comments, likes,
          follows, badges and stats are deleted from Trailing, and you&apos;re signed out
          everywhere.
        </Text>
      </View>

      {warning ? (
        <View style={[styles.warning, { backgroundColor: colors.errBg }]}>
          <Warning size={18} color={colors.err} />
          <Text variant="small" color="err" style={styles.warningText}>
            {warning}
          </Text>
        </View>
      ) : null}

      <TextField
        label="Password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setFieldError(null);
        }}
        error={fieldError ?? undefined}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={confirm}
        editable={!busy}
      />

      <FormError message={formError ?? blocker} />

      <Button
        label="Delete my account"
        variant="danger"
        icon={<Trash size={18} color={colors.err} />}
        onPress={confirm}
        loading={busy}
        disabled={blocker !== null}
      />
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
  heading: {
    gap: 8,
  },
  warning: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radius.card,
  },
  warningText: {
    flex: 1,
  },
});
