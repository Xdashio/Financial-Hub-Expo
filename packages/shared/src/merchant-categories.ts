"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALWAYS_BLOCKED_CATEGORIES = exports.MERCHANT_CATEGORIES = void 0;
exports.isAlwaysBlockedCategory = isAlwaysBlockedCategory;
exports.getMerchantCategoryLabel = getMerchantCategoryLabel;
/**
 * Ordered for picker display. Excludes 'unclassified' — that's an internal
 * state, never something a user selects.
 */
exports.MERCHANT_CATEGORIES = [
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
exports.ALWAYS_BLOCKED_CATEGORIES = exports.MERCHANT_CATEGORIES.filter((c) => c.alwaysBlocked).map((c) => c.id);
/** True if this category is blocked from every pocket with no override — e.g. gambling_betting. */
function isAlwaysBlockedCategory(category) {
    return exports.ALWAYS_BLOCKED_CATEGORIES.includes(category);
}
const LABEL_BY_ID = {
    ...Object.fromEntries(exports.MERCHANT_CATEGORIES.map((c) => [c.id, c.label])),
    unclassified: 'Unclassified',
};
/**  label for a category id, falling back to the raw id if unknown. */
function getMerchantCategoryLabel(category) {
    return LABEL_BY_ID[category] ?? category;
}