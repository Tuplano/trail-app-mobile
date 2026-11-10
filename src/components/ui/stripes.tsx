import { StyleSheet } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { useColors } from '@/theme/use-colors';

/**
 * The design's diagonal stripes, filling whatever holds it: where a map or
 * photo would be, before there is one. Each use needs its own `id` (SVG
 * pattern ids are shared across the screen).
 */
export function Stripes({ id, size = 16 }: { id: string; size?: number }) {
  const colors = useColors();
  return (
    <Svg style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <Defs>
        <Pattern
          id={id}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)">
          <Rect width={size} height={size} fill={colors.stripe2} />
          <Line
            x1={size / 4}
            y1={0}
            x2={size / 4}
            y2={size}
            stroke={colors.stripe1}
            strokeWidth={size / 2}
          />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
