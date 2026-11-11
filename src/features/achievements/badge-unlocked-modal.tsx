import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import type { Badge } from './achievements-api';
import { bonusXpLabel, type BadgeNews } from './badge-news';
import { BadgeIcon } from './badge-icon';

/**
 * The design's celebration: the badge glowing in a big ring, "BADGE
 * UNLOCKED", its name and description, the bonus xp, then Close or View
 * badges. Until the badge list loads it shows the notification's words.
 */
export function BadgeUnlockedModal({
  news,
  badge,
  onClose,
  onViewBadges,
}: {
  news: BadgeNews | null;
  badge: Badge | undefined;
  onClose: () => void;
  onViewBadges: () => void;
}) {
  const colors = useColors();
  const xp = bonusXpLabel(badge?.xp);

  return (
    <Modal
      visible={news !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        {news ? (
          <View
            accessibilityViewIsModal
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line3 }]}>
            <View
              style={[
                styles.ring,
                {
                  borderColor: colors.accent,
                  backgroundColor: colors.tint,
                  boxShadow: `0 0 48px ${colors.glow}`,
                },
              ]}>
              <BadgeIcon name={badge?.icon ?? ''} size={46} color={colors.accentText} />
            </View>
            <Text style={[styles.kicker, { color: colors.muted2 }]}>BADGE UNLOCKED</Text>
            <Text style={styles.name} accessibilityRole="header">
              {badge?.name ?? news.title}
            </Text>
            <Text style={[styles.description, { color: colors.muted }]}>
              {badge?.description ?? news.body}
            </Text>
            {xp ? (
              <View style={[styles.chip, { backgroundColor: colors.tint }]}>
                <Text style={[styles.chipText, { color: colors.accentText }]}>{xp}</Text>
              </View>
            ) : null}
            <View style={styles.buttons}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  {
                    borderWidth: 1,
                    borderColor: colors.line,
                    backgroundColor: pressed ? colors.line2 : 'transparent',
                  },
                ]}>
                <Text style={[styles.buttonText, { color: colors.text2 }]}>Close</Text>
              </Pressable>
              <Pressable
                onPress={onViewBadges}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  {
                    borderWidth: 1.5,
                    borderColor: colors.accent,
                    backgroundColor: pressed ? colors.tint : 'transparent',
                  },
                ]}>
                <Text style={[styles.buttonText, styles.viewText, { color: colors.accentText }]}>
                  View badges
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
  },
  ring: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    marginTop: 6,
    fontFamily: fonts.mono[500],
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.88,
  },
  name: {
    fontFamily: fonts.sans[500],
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.52,
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.sans[400],
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  chipText: {
    fontFamily: fonts.sans[500],
    fontSize: 13,
    lineHeight: 17,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fonts.sans[400],
    fontSize: 15,
  },
  viewText: {
    fontFamily: fonts.sans[500],
  },
});
