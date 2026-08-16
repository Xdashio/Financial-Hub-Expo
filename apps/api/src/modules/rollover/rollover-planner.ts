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
