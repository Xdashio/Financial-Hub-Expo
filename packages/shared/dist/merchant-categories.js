"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALWAYS_BLOCKED_CATEGORIES = exports.MERCHANT_CATEGORIES = void 0;
exports.isAlwaysBlockedCategory = isAlwaysBlockedCategory;
exports.getMerchantCategoryLabel = getMerchantCategoryLabel;
/**
 * Ordered for picker display. Excludes 'unclassified' — that's an internal
 * state, never something a user selects.
 *
 * Icon strings are now category keys that map to Lucide icons with brand colors
 * via the mobile app's categoryIcons utility.
 */
exports.MERCHANT_CATEGORIES = [
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
exports.ALWAYS_BLOCKED_CATEGORIES = exports.MERCHANT_CATEGORIES.filter((c) => c.alwaysBlocked).map((c) => c.id);
/** True if this category is blocked from every pocket with no override — e.g. gambling_betting. */
function isAlwaysBlockedCategory(category) {
    return exports.ALWAYS_BLOCKED_CATEGORIES.includes(category);
}
const LABEL_BY_ID = {
    ...Object.fromEntries(exports.MERCHANT_CATEGORIES.map((c) => [c.id, c.label])),
    unclassified: 'Unclassified',
};
/** label for a category id, falling back to the raw id if unknown. */
function getMerchantCategoryLabel(category) {
    return LABEL_BY_ID[category] ?? category;
}
