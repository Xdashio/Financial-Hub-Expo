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