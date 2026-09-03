// Light and dark color palettes.
//
// Both palettes expose the SAME set of keys (a "semantic token" contract) —
// consumers should never reach for a raw hex value, only these named
// tokens via useTheme(). That's what makes a screen "theme-aware": it reads
// colors.paper / colors.ink / etc from the current theme instead of
// importing a static palette, so it repaints automatically when the mode
// changes.
//
// Keep this file as the single source of truth for color values. Anyone
// adding a new token must add it to BOTH palettes below.

export interface ColorPalette {
  // Base
  paper: string;
  surface: string;
  surfaceRaised: string;
  background: string;
  ink: string;
  inkSoft: string;
  sage: string;
  line: string;
  lineSoft: string;

  // Brand - Emerald (primary)
  emerald: string;
  emeraldDeep: string;
  emeraldTint: string;

  // Brand - Gold (accent/warning)
  gold: string;
  goldTint: string;

  // Brand - Plum (cooling-off)
  plum: string;
  plumTint: string;

  // Brand - Clay (friction/essential→discretionary)
  clay: string;
  clayTint: string;

  // Semantic
  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  error: string;
  errorTint: string;
  info: string;
  infoTint: string;

  // Fixed "hero card" pair — a deliberately dark card with light text used
  // for stat/summary panels (pocket detail, loan detail, plan summary,
  // onboarding result, etc). This is a fixed design accent, not a
  // theme-reactive surface, so unlike every other token above it must stay
  // IDENTICAL in both palettes. `ink`/`surface` swap meaning between light
  // and dark mode (ink is dark-on-light but flips to white-on-dark), so
  // components that used `colors.ink` for the card fill and `colors.surface`
  // for the text — assuming "ink is always dark, surface is always light" —
  // rendered correctly in light mode but inverted into a near-white card
  // with low-contrast gray text in dark mode. Use heroBg/heroText instead
  // of ink/surface for this specific pattern.
  heroBg: string;
  heroText: string;
}

export const lightColors: ColorPalette = {
  paper: '#F6F7F2',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  background: '#F6F7F2',
  ink: '#0A1A13', // Darker for better contrast in light mode
  inkSoft: '#2D3A32', // Darker for better readability
  sage: '#4A5A52', // Darker for better visibility in light mode
  line: '#C9CAC2',
  lineSoft: '#E0E1DA',

  emerald: '#1A4F3E', // Darker for better contrast in light mode
  emeraldDeep: '#0F2F26', // Darker for better contrast
  emeraldTint: '#E4EEE9',

  gold: '#A6762D', // Darker for better contrast
  goldTint: '#F3EBDA',

  plum: '#7A5F9D', // Darker for better contrast
  plumTint: '#EEE8F6',

  clay: '#B05320', // Darker for better contrast
  clayTint: '#F7E7DD',

  success: '#1A4F3E', // Darker for better contrast
  successTint: '#E4EEE9',
  warning: '#A6762D', // Darker for better contrast
  warningTint: '#F3EBDA',
  error: '#B05320', // Darker for better contrast
  errorTint: '#F7E7DD',
  info: '#7A5F9D', // Darker for better contrast
  infoTint: '#EEE8F6',

  heroBg: '#0A1A13',
  heroText: '#FFFFFF',
};

// Dark palette mirrors the light one's *relationships* (surfaces lighter
// than paper, brand colors brightened for contrast on dark backgrounds,
// tints become low-opacity-style deep fills) rather than just inverting
// values, so hierarchy and brand feel stay intact.
export const darkColors: ColorPalette = {
  paper: '#121815',
  surface: '#1B231F',
  surfaceRaised: '#232C27',
  background: '#121815',
  ink: '#FFFFFF', // Pure white for maximum readability in dark mode
  inkSoft: '#E8F0EB', // Nearly white for secondary text
  sage: '#D4E4DC', // Very light gray for tertiary text - critical for visibility
  line: '#4A5A52', // Much brighter for better visibility
  lineSoft: '#3A4A42', // Much brighter for subtle borders

  emerald: '#5FC4A8', // Much brighter for dark mode
  emeraldDeep: '#4A9F8A', // Much brighter for contrast
  emeraldTint: '#1C2E28',

  gold: '#F5C97E', // Much brighter for dark mode
  goldTint: '#332A18',

  plum: '#D4B8F0', // Much brighter for dark mode
  plumTint: '#2A2436',

  clay: '#F4A576', // Much brighter for dark mode
  clayTint: '#332019',

  success: '#5FC4A8', // Much brighter
  successTint: '#1C2E28',
  warning: '#F5C97E', // Much brighter
  warningTint: '#332A18',
  error: '#F4A576', // Much brighter
  errorTint: '#332019',
  info: '#D4B8F0', // Much brighter
  infoTint: '#2A2436',

  // Same fixed values as the light palette — see the comment on
  // ColorPalette.heroBg above for why this pair must not flip with theme.
  heroBg: '#0A1A13',
  heroText: '#FFFFFF',
};