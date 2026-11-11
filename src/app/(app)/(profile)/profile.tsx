import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInputInstance, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { GearSix } from '@/components/ui/icons';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useAuthStore } from '@/features/auth/auth-store';
import type { User } from '@/features/auth/session-storage';
import { describeAuthError, type FieldErrors } from '@/features/auth/validation';
import { useProfile } from '@/features/people/people-api';
import { followerLabel } from '@/features/people/people-cache';
import { ProfileCounts } from '@/features/people/profile-counts';
import { ProfileHeader } from '@/features/people/profile-header';
import { useRefreshMe, useUpdateMe } from '@/features/profile/profile-api';
import {
  type ProfileChanges,
  profileChanges,
  validateProfile,
} from '@/features/profile/validation';
import { useColors } from '@/theme/use-colors';

export default function ProfileScreen() {
  // The saved copy, so the profile shows offline. useRefreshMe updates it.
  const user = useAuthStore((s) => s.user);
  const refresh = useRefreshMe();
  const update = useUpdateMe();
  // Your counts (posts, followers, following) come from your public profile.
  const counts = useProfile(user?.id);

  // This screen only exists while signed in, and signing in always saves the user.
  if (!user) return null;

  return (
    <Screen edges={['top']} contentStyle={styles.page}>
      <MyProfileHeader user={user} followers={counts.data?.followerCount} />
      {counts.data ? (
        <ProfileCounts
          userId={user.id}
          posts={counts.data.postCount}
          followers={counts.data.followerCount}
          following={counts.data.followingCount}
        />
      ) : null}
      {refresh.error ? (
        <Text variant="small" color="muted2">
          Showing your saved profile. {errorMessage(refresh.error)}
        </Text>
      ) : null}

      {/* Remount when the saved values change, so the fields always start from them. */}
      <ProfileForm
        key={`${user.username}\n${user.displayName}`}
        user={user}
        onSave={(changes) => update.mutate(changes)}
        saving={update.isPending}
        saved={update.isSuccess}
        error={update.error}
      />
    </Screen>
  );
}

/**
 * Your header, as in the design: picture, name, "@maya · 128 followers" and
 * the gear (Settings; sign out lives there). Your email and join date sit
 * under it. The follower count needs signal; offline it shows the handle only.
 */
function MyProfileHeader({ user, followers }: { user: User; followers: number | undefined }) {
  const colors = useColors();
  const joined = new Date(user.createdAt).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <ProfileHeader
      name={user.displayName}
      avatarUrl={user.avatarUrl}
      subtitle={
        followers === undefined
          ? `@${user.username}`
          : `@${user.username} · ${followerLabel(followers)}`
      }
      right={
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => [
            styles.settings,
            { borderColor: colors.line, backgroundColor: pressed ? colors.hover : 'transparent' },
          ]}>
          <GearSix size={20} color={colors.text} />
        </Pressable>
      }>
      <Text variant="label" color="muted3" numberOfLines={1}>
        {user.email} · Joined {joined}
      </Text>
    </ProfileHeader>
  );
}

type ProfileFormProps = {
  user: User;
  onSave: (changes: ProfileChanges) => void;
  saving: boolean;
  saved: boolean;
  error: Error | null;
};

function ProfileForm({ user, onSave, saving, saved, error }: ProfileFormProps) {
  const [form, setForm] = useState({ displayName: user.displayName, username: user.username });
  const [errors, setErrors] = useState<FieldErrors>({});
  const usernameRef = useRef<TextInputInstance>(null);

  const changes = profileChanges(form, user);
  const dirty = Object.keys(changes).length > 0;
  // USERNAME_TAKEN maps onto the username field, like on sign-up.
  const server = describeAuthError(error);
  const fieldError = (name: string) => errors[name] ?? server.fields[name];
  const update = (name: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [name]: value }));

  const submit = () => {
    const found = validateProfile(form);
    setErrors(found);
    if (Object.keys(found).length > 0 || !dirty) return;
    onSave(changes);
  };

  return (
    <View style={styles.form}>
      <Text variant="subheading">Edit profile</Text>
      <FormError message={server.form} />
      <TextField
        label="Name"
        value={form.displayName}
        onChangeText={update('displayName')}
        error={fieldError('displayName')}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => usernameRef.current?.focus()}
      />
      <TextField
        ref={usernameRef}
        label="Username"
        value={form.username}
        onChangeText={update('username')}
        error={fieldError('username')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Button
        label="Save changes"
        onPress={submit}
        loading={saving}
        disabled={!dirty}
        style={styles.save}
      />
      {saved && !dirty ? (
        <Text
          variant="small"
          color="muted2"
          accessibilityLiveRegion="polite"
          style={styles.savedNote}>
          Profile saved.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 20,
  },
  form: {
    gap: 14,
    marginTop: 8,
  },
  save: {
    marginTop: 6,
  },
  savedNote: {
    textAlign: 'center',
  },
  settings: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
