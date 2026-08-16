import { formatWholeKsh } from '@financial-hub/shared';

/**
 * Canonical money display for Financial Hub.
 * Always "KSh" (Kenyan shilling short form) — never mix with "KES".
 *
 * Rounding for the default (whole-shilling) case is delegated to
 * @financial-hub/shared's formatWholeKsh so the API's insufficient_funds
 * message and every mobile screen round the same balance the same way.
 */
export function formatMoney(amount: number, opts?: { rounded?: boolean }): string {
  if (opts?.rounded === false) {
    return `KSh ${amount.toLocaleString('en-KE')}`;
  }
  return formatWholeKsh(amount);
}

export const MONEY_CURRENCY_LABEL = 'KSh';