/**
 * Canonical money display for Financial Hub.
 * Always "KSh" (Kenyan shilling short form) — never mix with "KES".
 */
export function formatMoney(amount: number, opts?: { rounded?: boolean }): string {
  const n = opts?.rounded === false ? amount : Math.round(amount);
  return `KSh ${n.toLocaleString('en-KE')}`;
}

export const MONEY_CURRENCY_LABEL = 'KSh';
