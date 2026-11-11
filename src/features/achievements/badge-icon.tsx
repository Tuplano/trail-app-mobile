import { type ComponentType, createElement } from 'react';

import {
  Boot,
  CalendarCheck,
  CalendarStar,
  Compass,
  FlagBanner,
  Footprints,
  type IconProps,
  Medal,
  Mountains,
  Path,
  Sneaker,
  Trophy,
  TrendUp,
} from '@/components/ui/icons';

/**
 * The API names each badge's icon after a Phosphor icon (the design's set),
 * e.g. "calendar-check". Only the ones in use are bundled; a name the app
 * doesn't know yet (a badge added on the server later) shows a medal.
 */
const ICONS: Record<string, ComponentType<IconProps>> = {
  boot: Boot,
  'calendar-check': CalendarCheck,
  'calendar-star': CalendarStar,
  compass: Compass,
  'flag-banner': FlagBanner,
  footprints: Footprints,
  medal: Medal,
  mountains: Mountains,
  path: Path,
  sneaker: Sneaker,
  trophy: Trophy,
  'trend-up': TrendUp,
};

/** A badge's icon by the name the API gives it. */
export function BadgeIcon({ name, ...props }: IconProps & { name: string }) {
  return createElement(ICONS[name] ?? Medal, props);
}
