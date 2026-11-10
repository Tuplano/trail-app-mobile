/**
 * Design tokens from the "Trail Mobile" Claude Design file. Names match the
 * design's CSS variables (--accent-hi → accentHi) so the two are easy to compare.
 */

const dark = {
  bg: '#050206',
  sheet: '#100d11',
  surface: '#18151a',
  raised: '#211d22',
  text: '#ffffff',
  text2: '#e4dfdd',
  muted: '#b9b1ad',
  muted2: '#a29894',
  muted3: '#958b87',
  faint: '#6f6764',
  line: '#3b3b3b',
  line2: '#242124',
  line3: '#545050',
  accent: '#9A8174',
  accentHi: '#b59c8f',
  accentText: '#d9c6bc',
  tint: '#2a211e',
  tint2: '#3d302a',
  accentDim: '#6b574d',
  hover: '#221e22',
  hover2: '#141114',
  stripe1: '#121013',
  stripe2: '#0c0a0d',
  err: '#e8a597',
  errBg: '#2f1d1a',
  glass: 'rgba(5,2,6,0.82)',
  glow: 'rgba(154,129,116,0.28)',
  // The switch knob: white in both themes, as in the design.
  knob: '#ffffff',
};

export type Palette = typeof dark;

const light: Palette = {
  bg: '#f6f4f3',
  sheet: '#ffffff',
  surface: '#ffffff',
  raised: '#ffffff',
  text: '#050206',
  text2: '#3b3b3b',
  muted: '#56504e',
  muted2: '#655e5b',
  muted3: '#716a67',
  faint: '#9a918d',
  line: '#e2ddda',
  line2: '#ece8e6',
  line3: '#c4bcb8',
  accent: '#9A8174',
  accentHi: '#86695b',
  accentText: '#6a5145',
  tint: '#f1eae6',
  tint2: '#e5d9d2',
  accentDim: '#c9b5aa',
  hover: '#f3efed',
  hover2: '#efebe9',
  stripe1: '#ebe7e5',
  stripe2: '#f2efed',
  err: '#a8473a',
  errBg: '#f8e9e6',
  glass: 'rgba(255,255,255,0.88)',
  glow: 'rgba(154,129,116,0.22)',
  // The switch knob: white in both themes, as in the design.
  knob: '#ffffff',
};

export const palettes = { dark, light } as const;
export type ColorName = keyof Palette;

/** Font family per weight: custom fonts need one family name per weight in React Native. */
export const fonts = {
  sans: {
    400: 'Inter_400Regular',
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
  },
  mono: {
    400: 'JetBrainsMono_400Regular',
    500: 'JetBrainsMono_500Medium',
  },
} as const;

export const radius = {
  input: 8,
  card: 14,
  pill: 26,
} as const;
