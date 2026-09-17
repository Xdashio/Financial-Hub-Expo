"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_MONEY_AMOUNT = void 0;
exports.toCents = toCents;
exports.fromCents = fromCents;
exports.sumMoney = sumMoney;
exports.netMoney = netMoney;
exports.formatWholeKsh = formatWholeKsh;
exports.round2 = round2;
exports.isFiniteMoney = isFiniteMoney;
/** Convert a decimal shilling amount (from the DB or user input) to integer cents. */
function toCents(amount) {
    // Round at the boundary, once — this is the only place float error can
    // enter, and it's bounded to sub-cent noise from the DB/JSON round-trip,
    // never compounded across a chain of additions.
    return Math.round(amount * 100);
}
/** Convert integer cents back to a decimal shilling amount. */
function fromCents(cents) {
    return cents / 100;
}
/** Sum a list of decimal shilling amounts using exact integer-cents arithmetic. */
function sumMoney(amounts) {
    const totalCents = amounts.reduce((sum, a) => sum + toCents(a), 0);
    return fromCents(totalCents);
}
/**
 * Add/subtract a list of signed decimal amounts (mirrors ledger reduce
 * patterns like `allocated + reallocatedOut - spent + rolloverNet`) without
 * ever doing the arithmetic in floating point.
 */
function netMoney(...amounts) {
    const totalCents = amounts.reduce((sum, a) => sum + toCents(a), 0);
    return fromCents(totalCents);
}
/** Whole-shilling display, matching mobile's formatMoney() default rounding. */
function formatWholeKsh(amount) {
    const rounded = Math.round(amount);
    // Put the sign before the currency label ("-KSh 2,166") rather than after
    // it ("KSh -2,166"), which is the conventional reading for negative money
    // and matters now that overridden overspends can produce negative
    // balances (see spend.service.ts's insufficient_funds override flow).
    const abs = Math.abs(rounded).toLocaleString('en-KE');
    return rounded < 0 ? `-KSh ${abs}` : `KSh ${abs}`;
}
/** Round to 2 decimal places (cents) using exact integer arithmetic. */
function round2(amount) {
    return fromCents(toCents(amount));
}
/**
 * Absolute ceiling for any single monetary amount accepted from a client
 * (M1). 100,000,000 KSh in integer-cents-safe range: well below
 * Number.MAX_SAFE_INTEGER even in cents (10^10), consistent with the
 * integer-cents math above, and far above any legitimate single income,
 * spend, allocation, invoice, or contract value in this product.
 */
exports.MAX_MONEY_AMOUNT = 100_000_000;
/** True for finite numbers only — rejects NaN/Infinity alongside the ceiling. */
function isFiniteMoney(amount) {
    return typeof amount === 'number' && Number.isFinite(amount);
}
