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
 * "Essential" = the catch-all Fixed Expenses pocket, plus category-scoped
 * food/transport pockets. Essential pockets get a hard block on blacklisted
 * categories (no override); everything else is discretionary and gets a
 * soft warning the user can review past.
 */
export function isEssentialPocket(pocket: Pocket): boolean {
  return pocket.kind === 'fixed' || pocket.category === 'food' || pocket.category === 'transport';
}

/** Merchant categories this pocket is allowed to pay out to. */
export function getAllowedCategoriesForPocket(pocket: Pocket): string[] {
  if (pocket.kind === 'fixed') {
    return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education'];
  }
  if (pocket.category === 'food') {
    return ['grocery'];
  }
  if (pocket.category === 'transport') {
    return ['transport'];
  }
  // Leisure/other discretionary spendable pockets, and savings: broad,
  // never-gambling allowance (gambling_betting is excluded here and
  // therefore always ends up in getBlockedCategoriesForPocket()).
  return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'personal_care', 'other'];
}

/** Merchant categories this pocket is blocked from paying out to — the complement of the allowed set. */
export function getBlockedCategoriesForPocket(pocket: Pocket): string[] {
  const allowed = getAllowedCategoriesForPocket(pocket);
  return ALL_MERCHANT_CATEGORIES.filter(c => !allowed.includes(c));
}