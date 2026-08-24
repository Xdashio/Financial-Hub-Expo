// ============================================================================
// Nudge engine calculators.
// GUIDE.md §7's three MVP nudge types, all implemented as pure functions so
// the projection/threshold math can be unit-tested without touching
// Supabase, and so the nudge engine (NudgesService) stays a thin
// data-fetching wrapper around them:
//   1. computeRunwayNudges     — per-pocket runway-vs-spend-velocity (below)
//   2. computeSurplusSweepNudges — spendable pocket sitting well above its
//      planned allocation (further down this file)
//   3. computeStreakAtRiskNudge  — no spend logged today, past the evening
//      cutoff (further down this file)
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Runway-vs-spend-velocity nudge
// ----------------------------------------------------------------------------
//
// This is the piece the audit calls "genuinely new work, not a port of
// anything" — it's a generalization of the "Runway low" nudge type already
// scoped nudge: only checks the
// freelancer plan's overall runway against a flat 3-day threshold) into a
// real per-pocket projection: does *this pocket's* current spend rate mean
// it empties before the horizon, and by how many days.

// Don't compute velocity off a single day's spend — one big grocery run on
// day 1 of a new pay period would otherwise look like a runaway pace and
// fire a nudge that's really just noise. Mirrors the same
// "don't let noise dominate a signal" principle as runway.calculator.ts's
// MIN_RUNWAY_DAYS floor and HISTORICAL_GAP_WINDOW.
export const MIN_DAYS_ELAPSED_FOR_VELOCITY = 2;

export interface PocketVelocitySnapshot {
  pocketId: string;
  pocketName: string;
  /** Ledger-derived remaining balance (SupabaseRepository.getPocketSummary().available). */
  availableBalance: number;
  /** Total spend from this pocket since the current period started. */
  spentInPeriod: number;
  /** Whole days elapsed in the current period, including today. */
  daysElapsedInPeriod: number;
}

export interface RunwayNudgeInput {
  /** Days remaining until the next expected income lands, including today. */
  horizonDays: number;
  /**
   * 'freelancer_runway' = derived from RunwayService (real adaptive runway).
   * 'calendar_month' = fallback for salaried/structured plans, which have
   * no runway concept (see RunwaySummary.applicable) — days left in the
   * current calendar month stands in for "until next expected payment".
   */
  horizonSource: 'freelancer_runway' | 'calendar_month';
  pockets: PocketVelocitySnapshot[];
}

export interface RunwayLowNudge {
  type: 'runway_low';
  pocketId: string;
  pocketName: string;
  /** Average spend/day from this pocket over the current period so far. */
  dailyVelocity: number;
  availableBalance: number;
  /** Whole days left in the pocket at the current velocity before it hits zero. */
  projectedDaysToDeplete: number;
  horizonDays: number;
  horizonSource: 'freelancer_runway' | 'calendar_month';
  /** How many days before the horizon the pocket is projected to run dry. */
  daysShort: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * For each spendable pocket, projects whether its current spend velocity
 * will drain it before `horizonDays` runs out, and if so by how many days.
 * Pure/no I/O — NudgesService is responsible for assembling the input from
 * the ledger and the plan's runway.
 */
export function computeRunwayNudges(input: RunwayNudgeInput): RunwayLowNudge[] {
  const nudges: RunwayLowNudge[] = [];

  for (const pocket of input.pockets) {
    if (pocket.daysElapsedInPeriod < MIN_DAYS_ELAPSED_FOR_VELOCITY) continue;
    // Already at/under zero is a today problem (checkSpend's insufficient_funds
    // block already covers it) — this nudge is specifically about the
    // proactive "you're headed for empty" case, not a pocket that's already
    // empty.
    if (pocket.availableBalance <= 0) continue;

    const dailyVelocity = pocket.spentInPeriod / pocket.daysElapsedInPeriod;
    // No spend, or net-negative (e.g. only reallocation credits landed) —
    // never depletes at this rate, nothing to flag.
    if (dailyVelocity <= 0) continue;

    const projectedDaysToDeplete = pocket.availableBalance / dailyVelocity;
    // On track: the pocket outlasts the horizon at the current pace.
    if (projectedDaysToDeplete >= input.horizonDays) continue;

    nudges.push({
      type: 'runway_low',
      pocketId: pocket.pocketId,
      pocketName: pocket.pocketName,
      dailyVelocity: round2(dailyVelocity),
      availableBalance: round2(pocket.availableBalance),
      projectedDaysToDeplete: Math.floor(projectedDaysToDeplete),
      horizonDays: input.horizonDays,
      horizonSource: input.horizonSource,
      daysShort: Math.max(1, Math.ceil(input.horizonDays - projectedDaysToDeplete)),
    });
  }

  // Most urgent (soonest to run dry) first, so the client only needs to
  // slice the front of the array for a "1-2 nudges" home-screen card.
  return nudges.sort((a, b) => a.projectedDaysToDeplete - b.projectedDaysToDeplete);
}

// ============================================================================
// Surplus-sweep nudge — audit_team.md item 4/5, §7 nudge type 1:
// "You have surplus in [pocket] — sweep KSh X to Savings?" Recommended Expo
// implementation's trigger rule: spendable pocket balance > 120% of its
// monthly allocation.
//
// `monthlyAllocation` is the pocket's planning ceiling (`monthly_allocation`
// on the pockets table — see supabase.repository.ts's getPocketSummary
// comment), never mutated after onboarding, so it's a stable "what this
// pocket is meant to hold" baseline to compare the live ledger balance
// against. The suggested sweep amount brings the pocket back down to that
// baseline rather than to zero, so a legitimately-larger-than-planned
// pocket doesn't get swept empty.
// ============================================================================

/** Balance-to-allocation ratio that triggers a surplus-sweep suggestion. */
export const SURPLUS_ALLOCATION_MULTIPLIER = 1.2;

export interface PocketAllocationSnapshot {
  pocketId: string;
  pocketName: string;
  /** Ledger-derived current balance (SupabaseRepository.getPocketSummary().available). */
  availableBalance: number;
  /** Planning ceiling (pockets.monthly_allocation). */
  monthlyAllocation: number;
}

export interface SweepSurplusNudge {
  type: 'sweep_surplus';
  pocketId: string;
  pocketName: string;
  /** Suggested amount to sweep — brings the pocket back to its monthly allocation. */
  amount: number;
  availableBalance: number;
  monthlyAllocation: number;
  targetPocketId: string;
  targetPocketName: string;
}

/**
 * Flags spendable pockets sitting well above their planned allocation and
 * suggests sweeping the excess into Savings. Pure/no I/O, same pattern as
 * computeRunwayNudges — NudgesService assembles the snapshots and the
 * Savings-pocket target from the ledger.
 */
export function computeSurplusSweepNudges(
  pockets: PocketAllocationSnapshot[],
  target: { pocketId: string; pocketName: string } | null,
): SweepSurplusNudge[] {
  if (!target) return [];

  const nudges: SweepSurplusNudge[] = [];
  for (const pocket of pockets) {
    // No allocation on file (e.g. a sub-pocket with a zero planning
    // ceiling) — nothing to compare the balance against.
    if (pocket.monthlyAllocation <= 0) continue;

    const threshold = pocket.monthlyAllocation * SURPLUS_ALLOCATION_MULTIPLIER;
    if (pocket.availableBalance <= threshold) continue;

    const amount = round2(pocket.availableBalance - pocket.monthlyAllocation);
    if (amount <= 0) continue;

    nudges.push({
      type: 'sweep_surplus',
      pocketId: pocket.pocketId,
      pocketName: pocket.pocketName,
      amount,
      availableBalance: round2(pocket.availableBalance),
      monthlyAllocation: pocket.monthlyAllocation,
      targetPocketId: target.pocketId,
      targetPocketName: target.pocketName,
    });
  }

  // Biggest surplus first — most actionable sweep leads the card.
  return nudges.sort((a, b) => b.amount - a.amount);
}

// ============================================================================
// Streak-at-risk nudge — audit_team.md item 4/5, §7 nudge type 2:
// "no spend logged today and it's past 6pm. 'Log a spend to keep your
// X-day streak alive.'"
//
// Deliberately a different signal from the push-notification version of
// streak-at-risk (NotificationSchedulerService.sendStreakAtRiskNudges),
// which gates on the absence of an EVENT_DAILY_OVERSPEND event and runs on
// a 15/18/21 UTC cron sweep. This is the in-app nudge-card version the §7
// spec describes directly: "no spend logged today", checked live whenever
// GET /insights/nudges is called, not on a schedule.
//
// The "past 6pm" cutoff is evaluated in UTC — no per-user timezone is
// stored anywhere in this codebase today (the push-notification cron
// deliberately fires across three UTC windows for exactly this reason, see
// notification-scheduler.service.ts). This is a known simplification, not
// a precise "6pm local time" check.
// ============================================================================

export const STREAK_AT_RISK_HOUR_UTC = 18;

export interface StreakAtRiskInput {
  currentStreak: number;
  /** True if any 'spend' transaction has landed today across the user's spendable pockets. */
  spentToday: boolean;
  now: Date;
}

export interface StreakAtRiskNudge {
  type: 'streak_at_risk';
  currentStreak: number;
}

export function computeStreakAtRiskNudge(input: StreakAtRiskInput): StreakAtRiskNudge | null {
  // No active streak to protect — the "keep your streak alive" framing
  // doesn't apply.
  if (input.currentStreak <= 0) return null;
  if (input.spentToday) return null;
  if (input.now.getUTCHours() < STREAK_AT_RISK_HOUR_UTC) return null;

  return { type: 'streak_at_risk', currentStreak: input.currentStreak };
}

export type NudgeItem = RunwayLowNudge | SweepSurplusNudge | StreakAtRiskNudge;