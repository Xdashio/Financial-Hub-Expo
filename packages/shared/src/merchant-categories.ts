import type { MerchantCategory } from './schemas';

export interface MerchantCategoryOption {
  id: MerchantCategory;
  label: string;
  icon: string;
  alwaysBlocked?: boolean;
}

/**
 * Ordered for picker display. Excludes 'unclassified' — that's an internal
 * state, never something a user selects.
 * 
 * Icon strings are now category keys that map to Lucide icons with brand colors
 * via the mobile app's categoryIcons utility.
 */
export const MERCHANT_CATEGORIES: MerchantCategoryOption[] = [
  { id: 'grocery', label: 'Groceries', icon: 'food' },
  { id: 'landlord_rent', label: 'Rent', icon: 'housing' },
  { id: 'utility', label: 'Utilities', icon: 'utilities' },
  { id: 'transport', label: 'Transport', icon: 'transport' },
  { id: 'healthcare', label: 'Healthcare', icon: 'healthcare' },
  { id: 'education', label: 'Education', icon: 'education' },
  { id: 'entertainment', label: 'Entertainment', icon: 'leisure' },
  { id: 'personal_care', label: 'Personal Care', icon: 'personal' },
  {
    id: 'gambling_betting',
    label: 'Betting & gambling',
    icon: 'other',
    alwaysBlocked: true,
  },
  { id: 'other', label: 'Other', icon: 'other' },
];

/**
 * Categories no pocket may ever pay out to, regardless of pocket kind or
 * category — see pocket-rules.ts. This is the single source of truth other
 * modules (spend blocking, review/self-classify eligibility, the mobile
 * classify screen) should check against instead of re-deriving "is this
 * essential" logic, which only tells you about the *pocket*, not whether
 * the *category itself* is reviewable at all.
 */
export const ALWAYS_BLOCKED_CATEGORIES: MerchantCategory[] = MERCHANT_CATEGORIES.filter(
  (c) => c.alwaysBlocked,
).map((c) => c.id);

/** True if this category is blocked from every pocket with no override — e.g. gambling_betting. */
export function isAlwaysBlockedCategory(category: string): boolean {
  return (ALWAYS_BLOCKED_CATEGORIES as string[]).includes(category);
}

const LABEL_BY_ID: Record<string, string> = {
  ...Object.fromEntries(MERCHANT_CATEGORIES.map((c) => [c.id, c.label])),
  unclassified: 'Unclassified',
};

/** label for a category id, falling back to the raw id if unknown. */
export function getMerchantCategoryLabel(category: string): string {
  return LABEL_BY_ID[category] ?? category;
}