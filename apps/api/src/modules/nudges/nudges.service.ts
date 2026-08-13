import { Injectable } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import { RunwayService } from '../runway/runway.service';
import { RolloverService } from '../rollover/rollover.service';
import { Plan, Pocket } from '../../database/database.types';
import {
  computeRunwayNudges,
  computeSurplusSweepNudges,
  computeStreakAtRiskNudge,
  RunwayLowNudge,
  SweepSurplusNudge,
  StreakAtRiskNudge,
  PocketVelocitySnapshot,
  PocketAllocationSnapshot,
  NudgeItem,
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
 * All three §7 MVP nudge types are implemented: runway/velocity (per-pocket,
 * genuinely new work — see nudge.calculator.ts), surplus-sweep, and
 * streak-at-risk. `getNudges` returns a plain array of the discriminated
 * `NudgeItem` union so the client can switch on `.type` per card.
 */
@Injectable()
export class NudgesService {
  constructor(
    private readonly repository: SupabaseRepository,
    private readonly runway: RunwayService,
    private readonly rollover: RolloverService,
  ) {}

  async getNudges(userId: string): Promise<NudgeItem[]> {
    const [runwayNudges, surplusNudges, streakNudge] = await Promise.all([
      this.getRunwayNudges(userId),
      this.getSurplusSweepNudges(userId),
      this.getStreakAtRiskNudge(userId),
    ]);

    const nudges: NudgeItem[] = [...runwayNudges, ...surplusNudges];
    if (streakNudge) nudges.push(streakNudge);
    return nudges;
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
   * Surplus-sweep check (§7 nudge type 1). For every spendable pocket in
   * the user's active plan, compares the live ledger balance against its
   * planning ceiling (`monthly_allocation`) and suggests sweeping anything
   * more than SURPLUS_ALLOCATION_MULTIPLIER over that ceiling into Savings.
   */
  async getSurplusSweepNudges(userId: string): Promise<SweepSurplusNudge[]> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) return [];

    const pockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
    const spendablePockets = pockets.filter((p) => p.kind === 'spendable');
    if (spendablePockets.length === 0) return [];

    // Nowhere to suggest sweeping to — Savings should always exist for an
    // onboarded plan, but a plan mid-migration or with a corrupted pocket
    // set shouldn't crash the nudge card, just skip this nudge type.
    const savingsPocket = pockets.find((p) => p.kind === 'savings');
    if (!savingsPocket) return [];
    const target = { pocketId: savingsPocket.id, pocketName: savingsPocket.name };

    const balances = await Promise.all(
      spendablePockets.map((p) => this.repository.getPocketSummary(p.id)),
    );

    const snapshots: PocketAllocationSnapshot[] = spendablePockets.map((pocket, i) => ({
      pocketId: pocket.id,
      pocketName: pocket.name,
      availableBalance: balances[i].available,
      monthlyAllocation: pocket.monthly_allocation,
    }));

    return computeSurplusSweepNudges(snapshots, target);
  }

  /**
   * Streak-at-risk check (§7 nudge type 2): an active streak with no spend
   * logged yet today, past the evening cutoff. See nudge.calculator.ts for
   * why this is a deliberately different signal from the push-notification
   * version of streak-at-risk.
   */
  async getStreakAtRiskNudge(userId: string, now = new Date()): Promise<StreakAtRiskNudge | null> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) return null;

    const pockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
    const spendablePockets = pockets.filter((p) => p.kind === 'spendable');
    if (spendablePockets.length === 0) return null;

    const [streak, spendTotals] = await Promise.all([
      this.rollover.getStreak(userId, now),
      this.repository.getSpendTotalsByPocketBetween(
        spendablePockets.map((p) => p.id),
        toUtcDayStart(now.toISOString()),
        now.toISOString(),
      ),
    ]);

    const spentToday = Array.from(spendTotals.values()).some((total) => total > 0);

    return computeStreakAtRiskNudge({
      currentStreak: streak.currentStreak,
      spentToday,
      now,
    });
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