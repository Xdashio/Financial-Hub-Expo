import { Injectable } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import { RunwayService } from '../runway/runway.service';
import { Plan } from '../../database/database.types';
import {
  computeRunwayNudges,
  RunwayLowNudge,
  PocketVelocitySnapshot,
} from './nudge.calculator';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Server-side nudge engine (FLUTTER_TO_EXPO_PORT_GUIDE.md §7 — `GET
 * /insights/nudges`). audit_team.md item 4/5's "ongoing monitoring" ask
 * ("recommend building the nudge engine generically enough to carry this
 * too, rather than as a separate system") is why this lives as its own
 * module rather than bolted onto SpendService: SpendService only ever runs
 * at the moment of a spend attempt, and this check is explicitly the
 * opposite of that — a background comparison that has to run with no spend
 * attempt in flight at all.
 *
 * This batch only implements the runway/velocity nudge type. Surplus-sweep
 * and streak-at-risk (the other two §7 nudge types) are intentionally not
 * built here yet — `getNudges` returns a plain array specifically so a
 * later batch can append more nudge-source methods to it without changing
 * the response shape.
 */
@Injectable()
export class NudgesService {
  constructor(
    private readonly repository: SupabaseRepository,
    private readonly runway: RunwayService,
  ) {}

  async getNudges(userId: string): Promise<RunwayLowNudge[]> {
    return this.getRunwayNudges(userId);
  }

  /**
   * The per-pocket runway-vs-spend-velocity check. For every spendable
   * pocket in the user's active plan, compares how fast it's being spent
   * down against how many days remain until the next expected income, and
   * flags the ones on track to run dry first.
   */
  async getRunwayNudges(userId: string): Promise<RunwayLowNudge[]> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) return [];

    const { periodStart, horizonDays, horizonSource } = await this.getPeriodAndHorizon(userId, plan);
    if (horizonDays == null || horizonDays <= 0) return [];

    const pockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
    const spendablePockets = pockets.filter((p) => p.kind === 'spendable');
    if (spendablePockets.length === 0) return [];

    const daysElapsedInPeriod = Math.max(
      1,
      Math.floor((Date.now() - Date.parse(periodStart)) / MS_PER_DAY) + 1,
    );

    const pocketIds = spendablePockets.map((p) => p.id);
    const [spendTotals, balances] = await Promise.all([
      this.repository.getSpendTotalsByPocketBetween(pocketIds, periodStart, new Date().toISOString()),
      Promise.all(spendablePockets.map((p) => this.repository.getPocketSummary(p.id))),
    ]);

    const snapshots: PocketVelocitySnapshot[] = spendablePockets.map((pocket, i) => ({
      pocketId: pocket.id,
      pocketName: pocket.name,
      availableBalance: balances[i].available,
      spentInPeriod: spendTotals.get(pocket.id) ?? 0,
      daysElapsedInPeriod,
    }));

    return computeRunwayNudges({ horizonDays, horizonSource, pockets: snapshots });
  }

  /**
   * Determines both "when did the current spend period start" (needed to
   * measure velocity) and "how many days until the next expected income"
   * (the horizon a pocket's balance needs to survive).
   *
   * Freelancer + daily plans reuse the real adaptive runway (RunwayService
   * — see docs/FREELANCER_RUNWAY.md): period start is the last income
   * event, horizon is the computed runwayDays. Every other plan (salaried,
   * or freelancer+structured) has no runway concept — RunwaySummary is
   * `{ applicable: false }` for them by design — so this falls back to the
   * calendar month: period start is the 1st, horizon is days left in the
   * month. That's the same "next expected payment" assumption the rest of
   * the app already makes for salaried plans (see PocketsService's flat
   * 30-day daily_cap default and getPocketSummary's days_remaining calc).
   */
  private async getPeriodAndHorizon(
    userId: string,
    plan: Plan,
  ): Promise<{ periodStart: string; horizonDays: number | null; horizonSource: 'freelancer_runway' | 'calendar_month' }> {
    if (plan.income_pattern === 'freelancer' && plan.type === 'daily') {
      const runwaySummary = await this.runway.getRunwayForPlan(userId, plan);
      if (!runwaySummary.applicable || runwaySummary.runwayDays == null) {
        return { periodStart: new Date().toISOString(), horizonDays: null, horizonSource: 'freelancer_runway' };
      }

      const incomeEvents = await this.repository.getIncomeEventsByUserId(userId);
      // getIncomeEventsByUserId sorts newest-first (see supabase.repository.ts).
      const lastIncomeDate = incomeEvents[0]?.date ?? plan.created_at;

      return {
        periodStart: toUtcDayStart(lastIncomeDate),
        horizonDays: runwaySummary.runwayDays,
        horizonSource: 'freelancer_runway',
      };
    }

    const now = new Date();
    const monthStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const dayOfMonth = now.getUTCDate();
    const horizonDays = daysInMonth - dayOfMonth + 1;

    return {
      periodStart: new Date(monthStartUtc).toISOString(),
      horizonDays,
      horizonSource: 'calendar_month',
    };
  }
}

/** Normalizes a date/datetime string to that UTC calendar day's midnight. */
function toUtcDayStart(dateIso: string): string {
  const d = new Date(dateIso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}