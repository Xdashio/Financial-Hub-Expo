import React from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { stitch } from '@/theme';

export type EmptyIllustrationVariant = 'empty' | 'no-results' | 'error';

interface EmptyIllustrationProps {
  variant?: EmptyIllustrationVariant;
  size?: number;
  color: string;
  accentColor: string;
}

/**
 * Replaces the "Lucide icon centered in a tinted rounded square" pattern
 * that every empty/error/no-results state in the app used (see the
 * pre-existing EmptyState.tsx) with a small scene built from the same
 * pocket-and-stitch language as PocketGlyph, ProgressRing, and PocketLoader.
 * Three variants, one shared vocabulary:
 *  - empty: the pocket flap is open and turned out — nothing inside.
 *  - no-results: a stitched circle (a magnifying glass, but drawn as a
 *    pocket's dashed seam) turns up nothing.
 *  - error: the stitch has come loose — a dropped stitch, not a caution icon.
 */
export function EmptyIllustration({ variant = 'empty', size = 72, color, accentColor }: EmptyIllustrationProps) {
  if (variant === 'no-results') {
    return (
      <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
        <Circle cx="31" cy="31" r="16" stroke={color} strokeWidth={2} strokeDasharray={`${stitch.dash + 1},${stitch.gap + 1}`} />
        <Circle cx="31" cy="31" r="16" stroke={color} strokeWidth={2} opacity={0.15} />
        <Line x1="42" y1="42" x2="54" y2="54" stroke={accentColor} strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    );
  }

  if (variant === 'error') {
    return (
      <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
        {/* pocket outline with a gap in the stitch line — a dropped stitch */}
        <Path
          d="M14 14 H46 L58 26 V50 A10 10 0 0 1 48 60 H24 A10 10 0 0 1 14 50 Z"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Line x1="20" y1="24" x2="34" y2="24" stroke={accentColor} strokeWidth={stitch.width + 0.5} strokeDasharray={`${stitch.dash + 2},${stitch.gap + 1}`} strokeLinecap="round" />
        {/* the dropped end of the thread */}
        <Path d="M40 24 L46 30 M46 24 L42 32" stroke={accentColor} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  // "empty" — default: the pocket's flap is folded outward, open and bare.
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <Path
        d="M14 14 H46 L58 26 V50 A10 10 0 0 1 48 60 H24 A10 10 0 0 1 14 50 Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Line x1="20" y1="24" x2="42" y2="24" stroke={color} strokeWidth={stitch.width + 0.5} strokeDasharray={`${stitch.dash + 2},${stitch.gap + 1}`} strokeLinecap="round" opacity={0.55} />
      {/* the folded-out flap, turned inside-out to show nothing's there */}
      <Path
        d="M27 38 Q36 30 45 38 Q45 48 36 52 Q27 48 27 38 Z"
        stroke={accentColor}
        strokeWidth={2}
        strokeLinejoin="round"
        opacity={0.7}
      />
    </Svg>
  );
}