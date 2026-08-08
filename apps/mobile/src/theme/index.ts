// import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';

export const colors = {
  // Base
  paper: '#F6F7F2',
  surface: '#FFFFFF',
  ink: '#16231D',
  inkSoft: '#3C4A42',
  sage: '#5B6B63',
  line: '#DEDFD6',
  lineSoft: '#E9EAE3',

  // Brand - Emerald (primary)
  emerald: '#1F5F4E',
  emeraldDeep: '#153F34',
  emeraldTint: '#E4EEE9',

  // Brand - Gold (accent/warning)
  gold: '#B8873A',
  goldTint: '#F3EBDA',

  // Brand - Plum (cooling-off)
  plum: '#8A6FB0',
  plumTint: '#EEE8F6',

  // Brand - Clay (friction/essential→discretionary)
  clay: '#C4622D',
  clayTint: '#F7E7DD',

  // Semantic
  success: '#1F5F4E',
  successTint: '#E4EEE9',
  warning: '#B8873A',
  warningTint: '#F3EBDA',
  error: '#C4622D',
  errorTint: '#F7E7DD',
  info: '#8A6FB0',
  infoTint: '#EEE8F6',
};

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
    shadowColor: '#16231D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  elevated: {
    shadowColor: '#16231D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
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

const theme = {
  colors,
  radius,
  spacing,
  typography,
  shadow,
  borderWidth,
  borderWidthThick,
  animation,
  touchTarget,
};

export default theme;