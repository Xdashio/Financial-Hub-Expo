import { Pocket } from '../database/database.types';

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
  // Leisure/other discretionary spendable pockets, and savings: broad,
  // never-gambling allowance (gambling_betting is excluded here and
  // therefore always ends up in getBlockedCategoriesForPocket()).
  return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'personal_care', 'other'];
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