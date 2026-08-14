import type { PocketGlyphKind } from '@/components/ui/PocketGlyph';

/**
 * Every pocket, regardless of category, is drawn with PocketGlyph keyed by
 * `kind` — one consistent brand glyph (see PocketGlyph.tsx) instead of a
 * category-literal icon map (a House for rent, a ShoppingBasket for
 * groceries, a Car for transport, etc). A pocket's name/category label
 * already carries the category distinction in text; the icon's job is to
 * say "this is a pocket," not to re-illustrate what it's for.
 *
 * Pulled out of the home screen (where this logic originated) so every
 * other pocket list — Manage Pockets, onboarding's plan preview, reallocation
 * pickers — stays on the same glyph instead of drifting back to Lucide
 * category icons per-screen.
 */
export function pocketGlyphKind(kind: string): PocketGlyphKind {
  if (kind === 'savings' || kind === 'fixed' || kind === 'loan') return kind;
  return 'spendable';
}