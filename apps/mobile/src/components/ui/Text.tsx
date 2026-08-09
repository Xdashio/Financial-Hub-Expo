import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'caption'
  | 'eyebrow';

// Semantic color intents, resolved against the current theme. 'primary' is
// the default — the normal reading color for the current mode (colors.ink).
// This is deliberately a small, closed set: reaching for a raw hex or a
// palette key that isn't one of these should be rare, and if you need one,
// pull `colors` from useTheme() yourself instead of hardcoding a value here.
export type TextColorIntent = 'primary' | 'secondary' | 'brand' | 'error' | 'inverse';

export interface ThemedTextProps extends Omit<RNTextProps, 'style'> {
  /** Typography scale to use. Defaults to 'body'. */
  variant?: TextVariant;
  /** Semantic color intent. Defaults to 'primary' (colors.ink). Ignored if `color` is set. */
  intent?: TextColorIntent;
  /** Escape hatch for a literal color value, when intent doesn't cover the case. */
  color?: string;
  style?: TextStyle | TextStyle[];
}

/**
 * Theme-aware Text component.
 *
 * This exists because raw RN `<Text>` renders at the OS default color
 * (effectively black) when no color is set, and it's easy to write
 * `<Text style={{ ...typography.eyebrow, marginBottom: 8 }}>Label</Text>` —
 * type-checks fine, looks correct in light mode purely by luck (default
 * black-on-light-paper), and is invisible in dark mode. Using this
 * component instead makes that class of bug structurally unlikely: color
 * always resolves against the live theme unless the caller opts out via an
 * explicit `color` override.
 *
 * Usage:
 *   <Text>Body copy, colors.ink by default</Text>
 *   <Text variant="eyebrow" intent="secondary">Section label</Text>
 *   <Text variant="title" color={colors.emeraldDeep}>Custom</Text>
 */
export function Text({ variant = 'body', intent = 'primary', color, style, children, ...props }: ThemedTextProps) {
  const { colors } = useTheme();

  const intentColors: Record<TextColorIntent, string> = {
    primary: colors.ink,
    secondary: colors.sage,
    brand: colors.emeraldDeep,
    error: colors.error,
    // For text sitting on a filled brand-color surface (buttons, selected
    // chips/cards) — resolves to something readable against colors.surface
    // in both modes, mirroring how Button.tsx handles its primary variant.
    inverse: colors.surface,
  };

  const resolvedColor = color ?? intentColors[intent];

  return (
    <RNText style={[typography[variant] as TextStyle, { color: resolvedColor }, style]} {...props}>
      {children}
    </RNText>
  );
}