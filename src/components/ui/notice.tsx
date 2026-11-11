import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { Button } from './button';
import { type IconProps, UsersThree } from './icons';
import { Text } from './text';

/**
 * A message card in a list's place: loading failed, nothing yet, or coming
 * soon. An icon on the accent tint, a title, a line, and maybe a button.
 */
export function Notice({
  title,
  body,
  action,
  icon: Icon = UsersThree,
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
  icon?: ComponentType<IconProps>;
}) {
  const colors = useColors();
  return (
    <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      <View style={[styles.icon, { backgroundColor: colors.tint }]}>
        <Icon size={26} color={colors.accentHi} />
      </View>
      <Text variant="subheading">{title}</Text>
      <Text color="muted" style={styles.body}>
        {body}
      </Text>
      {action && <Button label={action.label} variant="secondary" onPress={action.onPress} />}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginHorizontal: 22,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  body: {
    textAlign: 'center',
  },
});
