import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/auth-store';
import { ProfileForm } from '@/features/profile/profile-form';
import { useUpdateMe } from '@/features/profile/profile-api';

/**
 * Edit your name and username, opened by tapping your picture or name on
 * Profile. Not in the design (it has no edit screen); laid out like Settings.
 * Once saved, it goes back to Profile, which already shows the new name.
 */
export default function EditProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const update = useUpdateMe();

  // This screen only exists while signed in, and signing in always saves the user.
  if (!user) return null;

  return (
    // The header (with the back button) sits under the status bar already.
    <Screen edges={[]} contentStyle={styles.page}>
      <Text variant="title">Edit profile</Text>
      <ProfileForm
        user={user}
        onSave={(changes) => update.mutate(changes, { onSuccess: () => router.back() })}
        saving={update.isPending}
        error={update.error}
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
});
