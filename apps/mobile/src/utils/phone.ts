/**
 * Kenyan mobile validation shared by sign-in / sign-up.
 * Expects the 9-digit national number (without +254), optionally spaced.
 * Rejects repeating-digit sequences like 111111111 / 000000000 while
 * keeping the +254 prefix UX on the screens.
 */
export function isValidKenyanPhone(value: string): boolean {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length !== 9) return false;
  if (!(cleaned.startsWith('7') || cleaned.startsWith('1'))) return false;
  // Reject trivial all-same-digit sequences (e.g. 111111111). Sequential
  // runs like 123456789 are still accepted — L2 only required repeating digits.
  if (/^(\d)\1{8}$/.test(cleaned)) return false;
  return true;
}

export function toE164Kenyan(nationalNineDigits: string): string {
  return `+254${nationalNineDigits.replace(/\D/g, '')}`;
}

export function formatKenyanPhoneInput(text: string): string {
  const cleaned = text.replace(/\D/g, '').slice(0, 9);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
}
