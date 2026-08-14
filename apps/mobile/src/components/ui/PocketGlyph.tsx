import React from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { stitch } from '@/theme';

export type PocketGlyphKind = 'savings' | 'fixed' | 'spendable' | 'loan' | 'emergency' | 'locked';

interface PocketGlyphProps {
  kind: PocketGlyphKind;
  size?: number;
  color: string;
  /** Renders the stitch line and tab at lower opacity — for dense list rows. */
  muted?: boolean;
}

/**
 * Signature icon set for the app.
 *
 * Every pocket "kind" is drawn as the same fabric-pocket base — a rounded
 * silhouette with a sharp top-right corner (see `radius.pocket`) and a
 * single dashed stitch line — with one small interior mark that tells kinds
 * apart. This replaces literal, mismatched Lucide icons (a House for a rent
 * pocket, a ShoppingBasket for groceries, a Car for transport) with one
 * cohesive glyph family that's actually about the app's real subject: a
 * pocket holding money, not the thing the money gets spent on.
 *
 * All glyphs share one 24x24 viewBox and stroke weight so they drop into
 * any icon slot Lucide icons used to fill.
 */
export function PocketGlyph({ kind, size = 20, color, muted = false }: PocketGlyphProps) {
  const stitchOpacity = muted ? 0.35 : 0.55;

  // Shared pocket silhouette: flat top with a notch cut at the top-right
  // (echoes radius.pocket's sharp corner), rounded elsewhere.
  const pocketOutline = 'M4 4 H16 L20 8 V17 A3 3 0 0 1 17 20 H7 A3 3 0 0 1 4 17 Z';

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={pocketOutline} stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
      {/* the stitch — dashed seam just inside the top edge */}
      <Line
        x1="6.5" y1="7.5" x2="17" y2="7.5"
        stroke={color}
        strokeWidth={stitch.width}
        strokeDasharray={`${stitch.dash},${stitch.gap}`}
        strokeLinecap="round"
        opacity={stitchOpacity}
      />
      {/* kind mark, inside the pocket */}
      {kind === 'savings' && (
        <Circle cx="12" cy="14" r="2.75" stroke={color} strokeWidth={1.75} />
      )}
      {kind === 'fixed' && (
        <Path d="M12 11 V17 M9 14 H15" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      )}
      {kind === 'spendable' && (
        <Path d="M9 15.5 L12 11.5 L15 15.5" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === 'loan' && (
        <Path d="M9 12.5 L15 12.5 M15 12.5 L12.5 10 M15 12.5 L12.5 15" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === 'emergency' && (
        <Path d="M12 11 V14.5 M12 16.5 V16.6" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      )}
      {kind === 'locked' && (
        <Path
          d="M10 13.5 V12.2 A2 2 0 0 1 14 12.2 V13.5 M9.3 13.5 H14.7 V17 H9.3 Z"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}