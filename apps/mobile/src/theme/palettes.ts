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
}

export const lightColors: ColorPalette = {
  paper: '#F6F7F2',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  ink: '#16231D',
  inkSoft: '#3C4A42',
  sage: '#5B6B63',
  line: '#DEDFD6',
  lineSoft: '#E9EAE3',

  emerald: '#1F5F4E',
  emeraldDeep: '#153F34',
  emeraldTint: '#E4EEE9',

  gold: '#B8873A',
  goldTint: '#F3EBDA',

  plum: '#8A6FB0',
  plumTint: '#EEE8F6',

  clay: '#C4622D',
  clayTint: '#F7E7DD',

  success: '#1F5F4E',
  successTint: '#E4EEE9',
  warning: '#B8873A',
  warningTint: '#F3EBDA',
  error: '#C4622D',
  errorTint: '#F7E7DD',
  info: '#8A6FB0',
  infoTint: '#EEE8F6',
};

// Dark palette mirrors the light one's *relationships* (surfaces lighter
// than paper, brand colors brightened for contrast on dark backgrounds,
// tints become low-opacity-style deep fills) rather than just inverting
// values, so hierarchy and brand feel stay intact.
export const darkColors: ColorPalette = {
  paper: '#121815',
  surface: '#1B231F',
  surfaceRaised: '#232C27',
  ink: '#EDF1EE',
  inkSoft: '#B9C4BE',
  sage: '#8AA398',
  line: '#2E3A34',
  lineSoft: '#242E29',

  emerald: '#4FAF93',
  emeraldDeep: '#3A8A73',
  emeraldTint: '#1C2E28',

  gold: '#D9A75C',
  goldTint: '#332A18',

  plum: '#B29BD6',
  plumTint: '#2A2436',

  clay: '#E0805A',
  clayTint: '#332019',

  success: '#4FAF93',
  successTint: '#1C2E28',
  warning: '#D9A75C',
  warningTint: '#332A18',
  error: '#E0805A',
  errorTint: '#332019',
  info: '#B29BD6',
  infoTint: '#2A2436',
};