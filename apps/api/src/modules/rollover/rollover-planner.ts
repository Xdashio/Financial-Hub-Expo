import type { Pocket } from '../../database/database.types';

export interface PocketDaySpend {
  pocketId: string;
  pocketName: string;
  dailyCap: number;
  spent: number;
  available: number;
}

export interface PocketRolloverPlan {
  pocketId: string;
  pocketName: string;
  dailyCap: number;
  spent: number;
  unspent: number;
  rollAmount: number;
  overspent: boolean;
}

export interface DayRolloverPlan {
  date: string; // YYYY-MM-DD
  pockets: PocketRolloverPlan[];
  totalRollAmount: number;
  allUnderCap: boolean;
  anyOverspend: boolean;
}

/** Days in the UTC calendar month of `dateIso` (YYYY-MM-DD). */
export function daysInUtcMonth(dateIso: string): number {
  const [y, m] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Effective daily cap for a spendable pocket on a given day.
 * Prefers persisted daily_cap (daily plans); otherwise derives from
 * monthly_allocation ÷ days in that month (structured plans).
 * For structured plans, returns 0 since they don't use daily caps.
 */
export function effectiveDailyCap(pocket: Pick<Pocket, 'daily_cap' | 'monthly_allocation'>, dateIso: string, planType: string): number {
  // Structured plans don't use daily caps
  if (planType !== 'daily') {
    return 0;
  }
  
  if (pocket.daily_cap != null && pocket.daily_cap > 0) {
    return pocket.daily_cap;
  }
  const days = daysInUtcMonth(dateIso);
  if (days <= 0 || pocket.monthly_allocation <= 0) return 0;
  return pocket.monthly_allocation / days;
}

/**
 * Pure planner: given per-pocket spend/available for a day, decide what
 * rolls to Savings. Never rolls more than available. A day is a streak win
 * only when every spendable pocket stayed under (or at) its cap.
 */
export function planDayRollover(dateIso: string, inputs: PocketDaySpend[]): DayRolloverPlan {
  const pockets: PocketRolloverPlan[] = inputs.map((input) => {
    const overspent = input.spent > input.dailyCap && input.dailyCap > 0;
    const unspent = Math.max(0, input.dailyCap - input.spent);
    const rollAmount = overspent ? 0 : Math.min(unspent, Math.max(0, input.available));
    return {
      pocketId: input.pocketId,
      pocketName: input.pocketName,
      dailyCap: input.dailyCap,
      spent: input.spent,
      unspent,
      rollAmount,
      overspent,
    };
  });

  const anyOverspend = pockets.some((p) => p.overspent);
  const allUnderCap = pockets.length > 0 && pockets.every((p) => !p.overspent);

  // Overspend day: no money moves (streak loss). Zero roll amounts so callers
  // cannot accidentally credit Savings on a broken day.
  if (anyOverspend) {
    for (const p of pockets) p.rollAmount = 0;
  }

  const totalRollAmount = pockets.reduce((sum, p) => sum + p.rollAmount, 0);

  return {
    date: dateIso,
    pockets,
    totalRollAmount,
    allUnderCap,
    anyOverspend,
  };
}

/**
 * Calendar days left in the UTC month *after* today (today itself excluded,
 * since today's spend is already accounted for separately). Day 15 of a
 * 30-day month → 15 days remaining, matching the runway math used
 * elsewhere: today's slice is spent, the rest of the pot has to cover
 * what's left.
 */
export function remainingDaysAfterToday(dateIso: string): number {
  const [, , d] = dateIso.split('-').map(Number);
  const days = daysInUtcMonth(dateIso);
  return Math.max(0, days - d);
}

export interface OverspendPreviewInput {
  /** Today's persisted/derived daily cap for this pocket, before this spend. */
  dailyCap: number;
  /** How much has already been spent from this pocket today (before this request). */
  spentToday: number;
  /** The amount the user is trying to spend right now. */
  requestedAmount: number;
  /** Ledger available_balance for this pocket right now, before this spend. */
  availableBalance: number;
  /** Today's date, e.g. '2026-08-15'. */
  dateIso: string;
}

export interface OverspendPreview {
  /** True when spentToday + requestedAmount would exceed today's cap. */
  exceedsCap: boolean;
  currentDailyCap: number;
  /**
   * What the daily cap would become for the rest of the cycle if this
   * spend goes through: the pocket's remaining balance after the spend,
   * spread evenly across the days left in the month (today excluded).
   * On the last day of the month (0 days left) this is just the leftover
   * balance itself, so the UI has a sane number to show rather than a
   * divide-by-zero.
   */
  adjustedDailyCap: number;
  daysRemaining: number;
}

/**
 * Emergency-overspend preview for the daily-cap plan flow: does this spend
 * blow today's cap, and if the user goes ahead anyway, what does that mean
 * for the rest of the month? Pure so both the API (spend.service.ts) and
 * any future client-side preview can share the exact same math.
 */
export function previewDailyCapAfterSpend(input: OverspendPreviewInput): OverspendPreview {
  const { dailyCap, spentToday, requestedAmount, availableBalance, dateIso } = input;
  const daysRemaining = remainingDaysAfterToday(dateIso);
  const exceedsCap = dailyCap > 0 && spentToday + requestedAmount > dailyCap + 0.01;
  const balanceAfterSpend = Math.max(0, availableBalance - requestedAmount);
  const adjustedDailyCap =
    Math.round((balanceAfterSpend / Math.max(1, daysRemaining)) * 100) / 100;

  return {
    exceedsCap,
    currentDailyCap: Math.round(dailyCap * 100) / 100,
    adjustedDailyCap,
    daysRemaining,
  };
}

/** UTC calendar day keys from (today - catchupDays) through yesterday, oldest first. */
export function catchupDateIsos(now: Date, catchupDays: number): string[] {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const MS_DAY = 24 * 60 * 60 * 1000;
  const dates: string[] = [];
  for (let i = catchupDays; i >= 1; i--) {
    dates.push(new Date(todayUtc - i * MS_DAY).toISOString().slice(0, 10));
  }
  return dates;
}

export function utcDayBounds(dateIso: string): { startIso: string; endIsoExclusive: string } {
  const startIso = `${dateIso}T00:00:00.000Z`;
  const startMs = Date.parse(startIso);
  const endIsoExclusive = new Date(startMs + 24 * 60 * 60 * 1000).toISOString();
  return { startIso, endIsoExclusive };
}