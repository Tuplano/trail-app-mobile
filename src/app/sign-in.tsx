import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { BrandMark } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useSignIn } from '@/features/auth/auth-api';
import { describeAuthError, type FieldErrors, validateSignIn } from '@/features/auth/validation';

export default function SignInScreen() {
  const signIn = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const passwordRef = useRef<TextInputInstance>(null);

  const server = describeAuthError(signIn.error);
  const fieldError = (name: string) => errors[name] ?? server.fields[name];

  const submit = () => {
    const found = validateSignIn({ email, password });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    signIn.mutate({ email: email.trim(), password });
    // On success the auth store flips to signedIn and the root layout
    // switches to the app on its own; there's no navigate() call here.
  };

  return (
    <Screen contentStyle={styles.page}>
      <BrandMark />
      <Text variant="display" style={styles.headline}>
        Record every trail, even without signal.
      </Text>
      <Text color="muted">Sign in once and stay signed in, even after days offline.</Text>

      <View style={styles.form}>
        <FormError message={server.form} />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
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
          value={password}
          onChangeText={setPassword}
          error={fieldError('password')}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button label="Sign in" onPress={submit} loading={signIn.isPending} style={styles.submit} />
        <Text variant="small" color="muted2" style={styles.switch}>
          New here?{' '}
          <Link href="/sign-up" replace>
            <Text variant="small" color="accentHi">
              Create an account
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
