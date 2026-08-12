import type { MerchantCategory } from './schemas';

export interface MerchantCategoryInfo {
  id: MerchantCategory;
  label: string;
  /** Material Community Icons name */
  icon?: string;
  /** True for categories that are always blocked from every pocket (see pocket-rules.ts). */
  alwaysBlocked?: boolean;
}

/**
 * Ordered for picker display. Excludes 'unclassified' — that's an internal
 * state, never something a user selects.
 */
export const MERCHANT_CATEGORIES: MerchantCategoryInfo[] = [
  { id: 'grocery', label: 'Groceries', icon: 'cart-outline' },
  { id: 'landlord_rent', label: 'Rent', icon: 'home-outline' },
  { id: 'utility', label: 'Utilities', icon: 'lightning-bolt-outline' },
  { id: 'transport', label: 'Transport', icon: 'car-outline' },
  { id: 'healthcare', label: 'Healthcare', icon: 'medical-bag' },
  { id: 'education', label: 'Education', icon: 'book-education-outline' },
  { id: 'entertainment', label: 'Entertainment', icon: 'movie-open-outline' },
  { id: 'personal_care', label: 'Personal Care', icon: 'content-cut' },
  {
    id: 'gambling_betting',
    label: 'Betting & gambling',
    icon: 'shield-alert-outline',
    alwaysBlocked: true,
  },
  { id: 'other', label: 'Other', icon: 'package-variant-closed' },
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
  (c) => c.alwaysBlocked
).map((c) => c.id);

/** True if this category is blocked from every pocket with no override — e.g. gambling_betting. */
export function isAlwaysBlockedCategory(category: string): boolean {
  return (ALWAYS_BLOCKED_CATEGORIES as string[]).includes(category);
}

const LABEL_BY_ID: Record<string, string> = {
  ...Object.fromEntries(
    MERCHANT_CATEGORIES.map((c) => [c.id, c.label])
  ),
  unclassified: 'Unclassified',
};

/**  label for a category id, falling back to the raw id if unknown. */
export function getMerchantCategoryLabel(category: string): string {
  return LABEL_BY_ID[category] ?? category;
}