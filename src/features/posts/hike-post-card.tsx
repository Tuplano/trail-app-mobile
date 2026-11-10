import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import type { Hike } from '@/db/hikes';
import type { PathPoint } from '@/db/track-points';
import { formatCount, formatHikeDuration, hikeTitle } from '@/features/history/hike-summary';
import { formatKm } from '@/features/record/format';
import { fonts, radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { routeOutline } from './route-outline';

const THUMB = 76;

/**
 * The hike being posted, as in the design: a small drawing of the route on
 * stripes, the name, and "12.40 km · 4h 12m · 860 m".
 */
export function HikePostCard({ hike, path }: { hike: Hike; path: readonly PathPoint[] }) {
  const colors = useColors();
  const outline = useMemo(() => routeOutline(path, THUMB, 12), [path]);
  const summary = [
    `${formatKm(hike.distanceM)} km`,
    formatHikeDuration(hike.movingTimeS),
    `${formatCount(hike.elevationGainM)} m`,
  ].join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      {/* A View clips the corners: an Svg's own borderRadius doesn't on Android. */}
      <View
        style={styles.thumb}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Svg width={THUMB} height={THUMB}>
          <Defs>
            {/* The design's diagonal stripes, where a map would be. */}
            <Pattern
              id="stripes"
              width={16}
              height={16}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)">
              <Rect width={16} height={16} fill={colors.stripe2} />
              <Line x1={4} y1={0} x2={4} y2={16} stroke={colors.stripe1} strokeWidth={8} />
            </Pattern>
          </Defs>
          <Rect width={THUMB} height={THUMB} fill="url(#stripes)" />
          {outline && (
            <>
              <Path
                d={outline.d}
                stroke={colors.accent}
                strokeOpacity={0.35}
                strokeWidth={6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d={outline.d}
                stroke={colors.accentText}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Circle
                cx={outline.start.x}
                cy={outline.start.y}
                r={4}
                fill={colors.bg}
                stroke={colors.text}
                strokeWidth={2}
              />
              <Circle
                cx={outline.end.x}
                cy={outline.end.y}
                r={3.5}
                fill={colors.accentText}
                stroke={colors.bg}
                strokeWidth={1.5}
              />
            </>
          )}
        </Svg>
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {hikeTitle(hike)}
        </Text>
        <Text variant="small" color="muted2">
          {summary}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 10,
    overflow: 'hidden',
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.sans[500],
  },
});
