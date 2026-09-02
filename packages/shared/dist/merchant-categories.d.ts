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
export declare const MERCHANT_CATEGORIES: MerchantCategoryOption[];
/**
 * Categories no pocket may ever pay out to, regardless of pocket kind or
 * category — see pocket-rules.ts. This is the single source of truth other
 * modules (spend blocking, review/self-classify eligibility, the mobile
 * classify screen) should check against instead of re-deriving "is this
 * essential" logic, which only tells you about the *pocket*, not whether
 * the *category itself* is reviewable at all.
 */
export declare const ALWAYS_BLOCKED_CATEGORIES: MerchantCategory[];
/** True if this category is blocked from every pocket with no override — e.g. gambling_betting. */
export declare function isAlwaysBlockedCategory(category: string): boolean;
/** label for a category id, falling back to the raw id if unknown. */
export declare function getMerchantCategoryLabel(category: string): string;
//# sourceMappingURL=merchant-categories.d.ts.map