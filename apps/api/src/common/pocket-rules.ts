import type { Pocket } from '../database/database.types';
import { isAlwaysBlockedCategory } from '@financial-hub/shared';

// Single source of truth for "what merchant categories can this pocket pay
// out to". Previously duplicated (and drifting) across SpendService and
// PocketsService — see PRD.md §3.5: "Essential pockets (Food, Rent) can
// only pay out to matching merchant categories (grocery, landlord,
// utility)... Blacklisted categories (gambling, betting) are blocked
// outright from essential pockets, and shown a warning if attempted from a
// discretionary pocket."
//
// A pocket's *own* category (food/transport/leisure, assigned at onboarding
// — see onboarding.service.ts SPENDABLE_CATEGORIES) has to gate this, not
// just its kind. Both duplicates originally only branched on
// `kind === 'fixed'`, so every 'spendable' pocket — food, transport, and
// leisure alike — got the same permissive allowance, letting money set
// aside for essentials (e.g. "Food & Groceries") cover discretionary spend
// (entertainment, personal care) with nothing stopping it.

// All merchant categories a pocket could ever be scoped to. Excludes the
// internal-only 'unclassified' bucket, which is never an allow/block target.
export const ALL_MERCHANT_CATEGORIES = [
  'grocery', 'landlord_rent', 'utility', 'transport', 'healthcare',
  'education', 'entertainment', 'gambling_betting', 'personal_care', 'other',
] as const;

/**
 * "Essential" = any Fixed Expenses pocket, plus category-scoped
 * food/transport/housing/family pockets. Essential pockets get a hard block
 * on blacklisted categories (no override); everything else is discretionary
 * and gets a soft warning the user can review past.
 */
export function isEssentialPocket(pocket: Pocket): boolean {
  if (pocket.kind === 'fixed') return true;
  return (
    pocket.category === 'food' ||
    pocket.category === 'transport' ||
    pocket.category === 'housing' ||
    pocket.category === 'family'
  );
}

/**
 * Merchant categories this pocket is allowed to pay out to.
 * Itemized fixed pockets (Batch 3) are single-purpose: their own category
 * maps to a tight merchant allow-list instead of the old catch-all Fixed
 * Expenses allowance.
 */
export function getAllowedCategoriesForPocket(pocket: Pocket): string[] {
  return allowedCategoriesForPocketUnguarded(pocket).filter(
    (c) => !isAlwaysBlockedCategory(c)
  );
}

// Defensive guard lives in the exported wrapper above so a future branch
// added here can never accidentally leak an always-blocked category (e.g.
// gambling_betting) into an allow-list again without someone deliberately
// bypassing isAlwaysBlockedCategory to do it.
function allowedCategoriesForPocketUnguarded(pocket: Pocket): string[] {
  if (pocket.kind === 'fixed') {
    return allowedMerchantsForFixedCategory(pocket.category);
  }
  if (pocket.category === 'food') {
    return ['grocery'];
  }
  if (pocket.category === 'transport') {
    return ['transport'];
  }
  if (pocket.category === 'family') {
    return ['education', 'healthcare', 'grocery', 'other'];
  }
  if (pocket.category === 'housing') {
    return ['landlord_rent', 'utility'];
  }
  if (pocket.kind === 'spendable' && pocket.category === 'leisure') {
    // Discretionary spend — PRD §3.5: blacklisted categories get a
    // *warning* from a discretionary pocket, which is softer than
    // essential's hard block. But "warning" is not "override": per the
    // 2026-08-12 team reconciliation, gambling_betting stays hard-blocked
    // from every pocket, leisure included — self-classify is reserved for
    // genuinely *unclassified* recipients (P2P, unregistered till/Pochi la
    // Biashara), never for a recipient already known to be gambling. The
    // "warning" a leisure pocket shows is the blocked message itself, plus
    // the "report it" path (merchant-report, not self-classify) if the
    // categorization looks wrong. See ALWAYS_BLOCKED_CATEGORIES.
    return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'personal_care', 'other'];
  }
  if (pocket.kind === 'savings') {
    // Savings is the pocket the whole product exists to protect — per the
    // 2026-08-12 reconciliation it's scoped down to essential categories
    // only, same as a fixed pocket, not the broad discretionary allowance
    // other non-essential spendable pockets get. It should never be usable
    // for discretionary/leisure spend, gambling or otherwise.
    return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education'];
  }
  // Any other non-leisure discretionary spendable pocket (personal,
  // utilities, healthcare, education, other as a spendable category):
  // broad discretionary allowance.
  return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'personal_care', 'other'];
}

/**
 * Whether a block on this merchant category can ever be resolved via the
 * "Review and classify" self-classify flow, for ANY pocket. Distinct from
 * pocket-level essential/discretionary status: this is about the category
 * itself. gambling_betting is blocked everywhere with no override, so it's
 * never reviewable — the only path for a known gambling merchant is
 * "report it" (disputes the classification, doesn't unblock it). Every
 * other block is a routing problem ("wrong pocket for this category"),
 * which self-classify legitimately solves by picking pocket + category
 * again — see PRD §3.5's "sort, don't block" framing.
 */
export function isReviewableBlock(category: string): boolean {
  return !isAlwaysBlockedCategory(category);
}

function allowedMerchantsForFixedCategory(category: string | null): string[] {
  switch (category) {
    case 'housing':
      return ['landlord_rent'];
    case 'utilities':
      return ['utility'];
    case 'education':
      return ['education'];
    case 'transport':
      return ['transport'];
    case 'healthcare':
      return ['healthcare'];
    case 'food':
      return ['grocery'];
    case 'family':
      return ['education', 'healthcare', 'other'];
    case 'leisure':
      return ['entertainment', 'personal_care', 'other'];
    case 'personal':
      return ['personal_care', 'other'];
    // Legacy lump "Fixed Expenses" pocket (category null) keeps the broad
    // essential allow-list so existing plans keep working until retake.
    default:
      return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education'];
  }
}

/** Merchant categories this pocket is blocked from paying out to — the complement of the allowed set. */
export function getBlockedCategoriesForPocket(pocket: Pocket): string[] {
  const allowed = getAllowedCategoriesForPocket(pocket);
  return ALL_MERCHANT_CATEGORIES.filter(c => !allowed.includes(c));
}