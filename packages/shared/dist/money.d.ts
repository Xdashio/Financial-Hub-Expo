/**
 * Money math for Financial Hub.
 *
 * Postgres NUMERIC columns already store exact decimal values — there is no
 * drift risk in the database. The drift risk lives entirely in JavaScript:
 * every value that crosses the API boundary becomes an IEEE-754 float, and
 * repeated +/- across many ledger rows (see getPocketSummary's reduce) can
 * accumulate rounding error that a single Math.round(n*100)/100 patch does
 * not prevent.
 *
 * The fix real financial systems use (M-Pesa, Modern Treasury, Stripe, etc.)
 * is to do the arithmetic in integer minor units (cents) and only convert
 * back to a decimal shilling amount at the edges — for display, or when
 * handing a value to Postgres NUMERIC, which is exact regardless.
 *
 * Usage:
 *   const cents = toCents(2165.72);        // 216572 (exact integer)
 *   const total = cents + toCents(0.28);   // 216600 (exact integer add)
 *   fromCents(total);                       // 2166 (exact, no float error)
 */
/** Convert a decimal shilling amount (from the DB or user input) to integer cents. */
export declare function toCents(amount: number): number;
/** Convert integer cents back to a decimal shilling amount. */
export declare function fromCents(cents: number): number;
/** Sum a list of decimal shilling amounts using exact integer-cents arithmetic. */
export declare function sumMoney(amounts: number[]): number;
/**
 * Add/subtract a list of signed decimal amounts (mirrors ledger reduce
 * patterns like `allocated + reallocatedOut - spent + rolloverNet`) without
 * ever doing the arithmetic in floating point.
 */
export declare function netMoney(...amounts: number[]): number;
/** Whole-shilling display, matching mobile's formatMoney() default rounding. */
export declare function formatWholeKsh(amount: number): string;
/** Round to 2 decimal places (cents) using exact integer arithmetic. */
export declare function round2(amount: number): number;
/**
 * Absolute ceiling for any single monetary amount accepted from a client
 * (M1). 100,000,000 KSh in integer-cents-safe range: well below
 * Number.MAX_SAFE_INTEGER even in cents (10^10), consistent with the
 * integer-cents math above, and far above any legitimate single income,
 * spend, allocation, invoice, or contract value in this product.
 */
export declare const MAX_MONEY_AMOUNT = 100000000;
/** True for finite numbers only — rejects NaN/Infinity alongside the ceiling. */
export declare function isFiniteMoney(amount: unknown): amount is number;
//# sourceMappingURL=money.d.ts.map