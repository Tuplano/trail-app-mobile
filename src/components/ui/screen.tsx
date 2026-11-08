import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '@/theme/use-colors';

type ScreenProps = {
  children: ReactNode;
  /** Tab screens skip the bottom edge: the tab bar already pads for it. */
  edges?: Edge[];
  contentStyle?: ViewStyle;
};

/** Scrollable page on the design's background, kept clear of the keyboard. */
export function Screen({ children, edges = ['top', 'bottom'], contentStyle }: ScreenProps) {
  const colors = useColors();

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});
