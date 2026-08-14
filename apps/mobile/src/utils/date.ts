/**
 * Date utility functions for Financial Hub
 */

/**
 * Returns the number of days in a month (1-31)
 * Handles leap years for February
 * @param year - Full year (e.g., 2024)
 * @param month - Month (0-11, where 0 = January, 1 = February, etc.)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Gets the maximum valid day for each month
 * @param year - Year to check (for leap year calculation in February)
 * @param month - Month (0-11)
 */
export function getMaxDayForMonth(year: number, month: number): number {
  return getDaysInMonth(year, month);
}

/**
 * Validates if a day is valid for a given month
 * @param day - Day of month (1-31)
 * @param year - Year (defaults to current year)
 * @param month - Month (0-11, defaults to current month)
 * @returns true if the day is valid for the month
 */
export function isValidDayForMonth(day: number, year?: number, month?: number): boolean {
  const now = new Date();
  const checkYear = year ?? now.getFullYear();
  const checkMonth = month ?? now.getMonth();
  
  const maxDays = getDaysInMonth(checkYear, checkMonth);
  return day >= 1 && day <= maxDays;
}

/**
 * For recurring monthly expenses, returns appropriate validation
 * Days 29-31 are allowed but will fall on the last day in shorter months
 * @param day - Day to validate
 * @returns validation result with max day and whether it's safe for all months
 */
export function validateRecurringDay(day: number): { valid: boolean; maxDay: number; safeForAllMonths: boolean } {
  const maxDay = 31;
  const valid = day >= 1 && day <= maxDay;
  
  // Days 1-28 are safe for all months
  // Days 29-31 may fall on last day in shorter months
  const safeForAllMonths = day <= 28;
  
  return { valid, maxDay, safeForAllMonths };
}

/**
 * Gets the ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 */
export function getOrdinalSuffix(n: number): string {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}