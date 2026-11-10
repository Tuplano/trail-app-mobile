import { StyleSheet, View } from 'react-native';

import { UsersThree } from '@/components/ui/icons';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * A placeholder, so the tab bar has the design's four tabs. Posts from
 * hikers you follow and hikes nearby are built in Stage 5 (Social).
 */
export default function FeedScreen() {
  const colors = useColors();

  return (
    <Screen edges={['top']} contentStyle={styles.page}>
      <Text variant="title" style={styles.title}>
        Feed
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
        <View style={[styles.icon, { backgroundColor: colors.tint }]}>
          <UsersThree size={26} color={colors.accentHi} />
        </View>
        <Text variant="subheading">Coming soon</Text>
        <Text color="muted" style={styles.body}>
          Hikes shared by people you follow and by hikers nearby will show up here. Until then,
          your own hikes are in History.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 16,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  card: {
    alignItems: 'center',
    gap: 10,
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
