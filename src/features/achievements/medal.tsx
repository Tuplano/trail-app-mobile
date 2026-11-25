import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { fonts, type MedalMaterial } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { BadgeIcon } from './badge-icon';
import { roundedHexagonLength, roundedHexagonPath } from './emblem-shape';
import { medalMaterial, romanNumeral } from './progress-format';

const OUTLINE_RADIUS = 48;
const OUTLINE_LENGTH = roundedHexagonLength(OUTLINE_RADIUS);

/**
 * The one emblem every achievement is drawn with: a soft hexagon with a
 * dark face in a deep shade of its colour, one thin edge and the icon in
 * the colour itself. `material` is that colour (a rank's, or the accent
 * for a badge); null draws it locked, as a dim dashed outline.
 *
 * `progress` (0 to 1) runs a thin outline of the same shape round it,
 * clockwise from the top: the way to the next step. Past the last rank a
 * small tab under it shows the Prestige numeral.
 */
export function Emblem({
  material,
  icon,
  size,
  prestige = 0,
  progress,
}: {
  material: MedalMaterial | null;
  icon: string;
  size: number;
  prestige?: number;
  progress?: number;
}) {
  const colors = useColors();
  const ring = progress !== undefined;
  // Leave room for the progress outline round the emblem.
  const radius = ring ? 39 : 45;
  // About 1.3 px on screen, whatever the size.
  const edge = Math.max(1.6, 130 / size);
  const filled = ring ? Math.min(1, Math.max(0, progress)) * OUTLINE_LENGTH : 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {ring ? (
          <>
            <Path
              d={roundedHexagonPath(OUTLINE_RADIUS)}
              fill="none"
              stroke={colors.line2}
              strokeWidth={edge}
            />
            {filled > 0 ? (
              <Path
                d={roundedHexagonPath(OUTLINE_RADIUS)}
                fill="none"
                stroke={colors.accent}
                strokeWidth={edge}
                strokeLinecap="round"
                strokeDasharray={`${filled} ${OUTLINE_LENGTH}`}
              />
            ) : null}
          </>
        ) : null}
        <Path
          d={roundedHexagonPath(radius)}
          fill={material ? material.deep : colors.surface}
          stroke={material ? material.tone : colors.line}
          strokeOpacity={material ? 0.85 : 1}
          strokeWidth={edge * 1.5}
          strokeDasharray={material ? undefined : `${edge * 3} ${edge * 2.5}`}
        />
      </Svg>

      <View style={styles.icon} pointerEvents="none">
        <BadgeIcon
          name={icon}
          size={Math.round(size * (ring ? 0.32 : 0.38))}
          color={material ? material.tone : colors.line3}
        />
      </View>

      {prestige > 0 ? (
        <View
          style={[
            styles.prestige,
            {
              backgroundColor: material?.deep ?? colors.raised,
              borderColor: material?.tone ?? colors.line3,
            },
          ]}>
          <Text style={[styles.prestigeText, { color: material?.tone ?? colors.text }]}>
            {romanNumeral(prestige)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The app's accent as an emblem colour, for badges and ranks the app doesn't know. */
function useAccentMaterial(): MedalMaterial {
  const colors = useColors();
  return { tone: colors.accentText, deep: colors.tint };
}

/**
 * A rank medal: the emblem in its rank's colour (bronze, silver, gold... see
 * `medals` in tokens.ts) with the track's icon; locked before the first rank.
 */
export function Medal({
  rank,
  ...emblem
}: {
  /** The rank code from the API ('gold'), or null before the first rank. */
  rank: string | null;
  icon: string;
  size: number;
  prestige?: number;
  progress?: number;
}) {
  const accent = useAccentMaterial();
  const material = rank ? (medalMaterial(rank) ?? accent) : null;
  return <Emblem material={material} {...emblem} />;
}

/** A badge: the same emblem, in the app's accent once unlocked. */
export function BadgeEmblem({
  unlocked,
  icon,
  size,
}: {
  unlocked: boolean;
  icon: string;
  size: number;
}) {
  const accent = useAccentMaterial();
  return <Emblem material={unlocked ? accent : null} icon={icon} size={size} />;
}

const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prestige: {
    position: 'absolute',
    bottom: -2,
    alignSelf: 'center',
    minWidth: 22,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
  },
  prestigeText: {
    fontFamily: fonts.mono[500],
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
  },
});
