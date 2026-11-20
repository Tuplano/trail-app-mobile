import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { GoogleLogo } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { useColors } from '@/theme/use-colors';

import { googleSignInMessage } from './google-messages';
import { useGoogleSignIn } from './google-sign-in';

/**
 * "or" and a "Continue with Google" button, under the email form on the
 * sign-in and sign-up screens. One button for both: the first Google sign-in
 * creates the account. On success the auth store flips to signedIn and the
 * root layout switches to the app on its own.
 */
export function ContinueWithGoogle({ disabled = false }: { disabled?: boolean }) {
  const colors = useColors();
  const google = useGoogleSignIn();

  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: colors.line2 }]} />
        <Text variant="small" color="muted2">
          or
        </Text>
        <View style={[styles.line, { backgroundColor: colors.line2 }]} />
      </View>
      <FormError message={googleSignInMessage(google.error)} />
      <Button
        label="Continue with Google"
        variant="secondary"
        icon={<GoogleLogo size={18} color={colors.text} weight="bold" />}
        loading={google.isPending}
        disabled={disabled}
        onPress={() => google.mutate()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
});
