import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '@/theme/use-colors';

type ScreenProps = {
  children: ReactNode;
  /** Tab screens skip the bottom edge: the tab bar already pads for it. */
  edges?: Edge[];
  contentStyle?: ViewStyle;
  /**
   * False for screens that fill the space themselves, e.g. with a map: a map
   * inside a scroll view fights it over drag gestures.
   */
  scroll?: boolean;
};

/** Page on the design's background, kept clear of the keyboard. Scrolls by default. */
export function Screen({
  children,
  edges = ['top', 'bottom'],
  contentStyle,
  scroll = true,
}: ScreenProps) {
  const colors = useColors();

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentStyle]}>{children}</View>
        )}
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
