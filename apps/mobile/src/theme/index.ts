// import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';

export { lightColors, darkColors } from './palettes';
export type { ColorPalette } from './palettes';
export { ThemeProvider, useTheme } from './ThemeContext';
export type { ThemeMode } from './ThemeContext';

export const radius = {
  lg: 24,
  md: 18,
  sm: 14,
  xs: 10,
  pill: 999,
  // Dedicated, smaller radius for tappable buttons — kept as one token so
  // every Button instance (regardless of variant/size) stays visually
  // consistent app-wide.
  button: 10,
  // Signature shape — every "pocket" surface (pocket cards, the emergency
  // unlock sheet, empty-state panels) is drawn as an actual fabric pocket:
  // three soft corners and one sharp top-right corner, like a pocket flap
  // tucked in at the seam. Symmetric radii (above) stay the default for
  // ordinary chrome — this one is spent deliberately, only on surfaces that
  // represent money *held* somewhere, so it reads as intentional rather
  // than applied everywhere.
  pocket: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
  },
  // The little fabric tab sewn into a pocket card's top edge (see
  // PocketGlyph / renderPocketCard). One token so every tab across the app
  // is the same shape.
  tab: 4,
};

// Category-specific colors for pocket color coding
export const categoryColors: Record<string, string> = {
  food: '#1F5F4E',
  transport: '#8A6FB0',
  leisure: '#C4622D',
  shopping: '#E8754A',
  bills: '#4A6FA5',
  health: '#4A9F6F',
  education: '#6F4A9F',
  entertainment: '#9F4A6F',
  other: '#6B7280',
};

// Shared rhythm for the dashed "stitch" line that runs through every pocket
// surface — icons, the progress ring, the loader, empty-state illustrations.
// One constant so the stitch reads as the same thread everywhere instead of
// each component inventing its own dash spacing.
export const stitch = {
  dash: 4,
  gap: 3,
  width: 1.5,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Single typeface, single (normal) weight across the whole app — Plus
// Jakarta Sans Medium. Hierarchy between display/title/heading/body comes
// from size, line-height and letter-spacing only, never from mixing in
// heavier font-family variants or RN's synthetic `fontWeight`.
export const typography = {
  fontFamily: 'PlusJakartaSans_500Medium',

  display: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.26,
  },
  title: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.18,
  },
  heading: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    lineHeight: 21,
  },
  caption: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 16,
  },
  eyebrow: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.88,
    textTransform: 'uppercase' as const,
  },
  numbers: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.01,
  },
};

export const shadow = {
  default: {
    boxShadow: '0px 1px 2px rgba(22, 35, 29, 0.04)',
    elevation: 1,
  },
  elevated: {
    boxShadow: '0px 8px 24px rgba(22, 35, 29, 0.06)',
    elevation: 8,
  },
};

export const borderWidth = 1;
export const borderWidthThick = 1.5;

export const animation = {
  fast: 120,
  normal: 150,
  slow: 200,
};

export const touchTarget = {
  minHeight: 44,
  minWidth: 44,
};