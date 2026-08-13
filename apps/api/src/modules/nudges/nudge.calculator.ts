// ============================================================================
// Runway-vs-spend-velocity nudge — audit_team.md item 4/5, sub-point 3:
// "a background comparison of spend velocity vs. remaining runway per
// pocket, independent of any single spend attempt, that can proactively
// flag 'you're on track to run out of Transport 6 days before your next
// income' before the user even tries to overspend."
//
// This is the piece the audit calls "genuinely new work, not a port of
// anything" — it's a generalization of the "Runway low" nudge type already
// scoped in FLUTTER_TO_EXPO_PORT_GUIDE.md §7 (which only checked the
// freelancer plan's overall runway against a flat 3-day threshold) into a
// real per-pocket projection: does *this pocket's* current spend rate mean
// it empties before the horizon, and by how many days.
//
// Kept as a pure function, same pattern as runway.calculator.ts, so the
// projection math can be unit-tested without touching Supabase, and so the
// nudge engine (NudgesService) stays a thin data-fetching wrapper around it.
// ============================================================================

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