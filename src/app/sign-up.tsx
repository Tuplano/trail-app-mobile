import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { BrandMark } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useSignUp } from '@/features/auth/auth-api';
import { describeAuthError, type FieldErrors, validateSignUp } from '@/features/auth/validation';

export default function SignUpScreen() {
  const signUp = useSignUp();
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const usernameRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const server = describeAuthError(signUp.error);
  const fieldError = (name: string) => errors[name] ?? server.fields[name];
  const update = (name: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [name]: value }));

  const submit = () => {
    const found = validateSignUp(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    signUp.mutate({
      displayName: form.displayName.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
    });
  };

  return (
    <Screen contentStyle={styles.page}>
      <BrandMark />
      <Text variant="display" style={styles.headline}>
        Create your account.
      </Text>
      <Text color="muted">Hikes save to your phone first and upload once you have signal.</Text>

      <View style={styles.form}>
        <FormError message={server.form} />
        <TextField
          label="Name"
          value={form.displayName}
          onChangeText={update('displayName')}
          error={fieldError('displayName')}
          placeholder="Maya Okafor"
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
          placeholder="maya"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <TextField
          ref={emailRef}
          label="Email"
          value={form.email}
          onChangeText={update('email')}
          error={fieldError('email')}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label="Password"
          value={form.password}
          onChangeText={update('password')}
          error={fieldError('password')}
          placeholder="At least 8 characters"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button
          label="Create account"
          onPress={submit}
          loading={signUp.isPending}
          style={styles.submit}
        />
        <Text variant="small" color="muted2" style={styles.switch}>
          Already have an account?{' '}
          <Link href="/sign-in" replace>
            <Text variant="small" color="accentHi">
              Sign in
            </Text>
          </Link>
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingHorizontal: 28,
    paddingBottom: 44,
  },
  headline: {
    marginTop: 32,
    marginBottom: 10,
  },
  form: {
    gap: 14,
    marginTop: 'auto',
    paddingTop: 32,
  },
  submit: {
    marginTop: 6,
  },
  switch: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 14,
  },
});
