import type { Ref } from 'react';
import {
  StyleSheet,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  View,
} from 'react-native';

import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { Text } from './text';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  /** Lets a form move focus to this field (e.g. "next" on the keyboard). */
  ref?: Ref<TextInputInstance>;
};

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const colors = useColors();

  return (
    <View style={styles.wrapper}>
      <Text variant="label" color="muted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.faint}
        selectionColor={colors.accent}
        style={[
          styles.input,
          {
            borderColor: error ? colors.err : colors.line,
            backgroundColor: colors.surface,
            color: colors.text,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="label" color="err">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: radius.input,
    borderWidth: 1,
    fontFamily: fonts.sans[400],
    fontSize: 15,
  },
});
