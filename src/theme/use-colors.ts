import { useColorScheme } from 'react-native';

import { type Palette, palettes } from './tokens';

/** The design is dark-first, so dark is also the fallback when the scheme is unknown. */
export function useColors(): Palette {
  return useColorScheme() === 'light' ? palettes.light : palettes.dark;
}
