import { RunwaySummary } from '@financial-hub/shared';

// ============================================================================
// Freelancer adaptive runway — "medium" tier calculation.
// See docs/FREELANCER_RUNWAY.md for the full design writeup, the psychology
// rationale behind the constants below, and the documented upgrade path to
// the "full adaptive" tier (seasonality, per-source cadence, confidence
// intervals). Do not silently extend this file without updating that doc —
// this feature exists specifically because an earlier version of it was
// designed-but-undocumented and quietly rotted; don't repeat that.
// ============================================================================

// Never let the runway (and therefore the derived daily cap) collapse to
// zero or go negative just because a payment is late. A hard floor keeps
// the adaptive cap supportive, not punitive — same principle already
// settled for the reallocation cooling-off timer in PRD.md §3.4.
export const MIN_RUNWAY_DAYS = 3;

// Clamp the *assumed cycle length* too, in both directions. Without an
// upper bound, one very late or missed payment would permanently balloon
// the historical average and keep inflating the cap for months. Without a
// lower bound, two payments landing unusually close together (e.g. an
// invoice paid early) would shrink the assumed cycle to something
// unrealistically tight.
export const MIN_EXPECTED_INTERVAL_DAYS = 5;
export const MAX_EXPECTED_INTERVAL_DAYS = 60;

// How many of the most recent payment gaps to average when historical data
// is available. Small on purpose: a freelancer's cadence can genuinely
// change (new client, slow season), and a long lookback would make the
// runway slow to reflect that. 3 gaps needs 4 income events.
const HISTORICAL_GAP_WINDOW = 3;

export interface RunwayIncomeEvent {
  date: string; // ISO date, e.g. '2026-07-15'
}

export interface ComputeRunwayInput {
  /** Only 'freelancer' + 'daily' plans get a runway; caller decides applicability. */
  incomeIntervalDaysEstimate: number | null; // from plans.income_interval_days (onboarding band)
  /** Sorted most-recent-first, as returned by getIncomeEventsByUserId. */
  incomeEvents: RunwayIncomeEvent[];
  today: Date;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function daysBetween(later: Date, earlier: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Computes the freelancer's current runway: how many days until they'd
 * "expect" their next payment, based on either their real income history
 * (once there's enough of it) or their onboarding pay-cadence estimate.
 *
 * This is the "medium" tier: a rolling average of real gaps once available,
 * a clamped floor so the derived daily cap never punishes a late payment,
 * and no forecasting beyond that. See docs/FREELANCER_RUNWAY.md for what
 * "full adaptive" adds on top of this later (seasonality, per-source
 * cadence tracking, confidence intervals feeding UI copy).
 */
export interface RunwayCappablePocket {
  id: string;
  kind: string;
  monthly_allocation: number;
}

/**
 * Given the current runway and a plan's pockets, returns the new daily_cap
 * for each spendable pocket. Shared by the read path (PocketsService —
 * live, never persisted) and the income-event write path (IncomeService —
 * persisted so the cap stays correct for any other reader) so the two
 * don't drift apart. See docs/FREELANCER_RUNWAY.md.
 */
export function computeSpendableDailyCaps(
  pockets: RunwayCappablePocket[],
  runway: RunwaySummary
): Map<string, number> {
  const result = new Map<string, number>();
  if (!runway.applicable || !runway.runwayDays) {
    return result;
  }
  const spendablePockets = pockets.filter((p) => p.kind === 'spendable');
  const totalMonthlySpendable = spendablePockets.reduce((sum, p) => sum + p.monthly_allocation, 0);
  const totalDailySpendable = totalMonthlySpendable / runway.runwayDays;
  const perPocketDailyCap = spendablePockets.length > 0 ? totalDailySpendable / spendablePockets.length : 0;
  for (const pocket of spendablePockets) {
    result.set(pocket.id, Math.round(perPocketDailyCap * 100) / 100);
  }
   return result;
}

/**
 * Computes the freelancer's current runway.
 */
export function computeRunway(input: ComputeRunwayInput): RunwaySummary {
  const { incomeIntervalDaysEstimate, incomeEvents, today } = input;

  const sortedDesc = [...incomeEvents].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let expectedIntervalDays: number;
  let confidence: 'estimate' | 'historical';

  if (sortedDesc.length >= 2) {
    const gapCount = Math.min(HISTORICAL_GAP_WINDOW, sortedDesc.length - 1);
    const gaps: number[] = [];
    for (let i = 0; i < gapCount; i++) {
      gaps.push(daysBetween(new Date(sortedDesc[i].date), new Date(sortedDesc[i + 1].date)));
    }
    const average = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    expectedIntervalDays = clamp(
      average > 0 ? average : incomeIntervalDaysEstimate ?? 30,
      MIN_EXPECTED_INTERVAL_DAYS,
      MAX_EXPECTED_INTERVAL_DAYS
    );
    confidence = 'historical';
  } else {
    expectedIntervalDays = clamp(
      incomeIntervalDaysEstimate ?? 30,
      MIN_EXPECTED_INTERVAL_DAYS,
      MAX_EXPECTED_INTERVAL_DAYS
    );
    confidence = 'estimate';
  }

  const daysSinceLastIncome = sortedDesc.length > 0 ? daysBetween(today, new Date(sortedDesc[0].date)) : 0;

  const runwayDays = clamp(
    expectedIntervalDays - daysSinceLastIncome,
    MIN_RUNWAY_DAYS,
    expectedIntervalDays
  );

  return {
    applicable: true,
    runwayDays,
    expectedIntervalDays,
    daysSinceLastIncome,
    confidence,
  };
}