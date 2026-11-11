import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { TextField } from '@/components/ui/text-field';
import type { User } from '@/features/auth/session-storage';
import { describeAuthError, type FieldErrors } from '@/features/auth/validation';

import { type ProfileChanges, profileChanges, validateProfile } from './validation';

type ProfileFormProps = {
  user: User;
  onSave: (changes: ProfileChanges) => void;
  saving: boolean;
  error: Error | null;
};

/**
 * Your name and username, starting from the saved values. Save is only on
 * once something changed, and sends only what changed.
 */
export function ProfileForm({ user, onSave, saving, error }: ProfileFormProps) {
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
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
  },
  save: {
    marginTop: 6,
  },
});
