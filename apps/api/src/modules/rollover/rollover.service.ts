import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { PushDeliveryService } from '../notifications/push-delivery.service';
import {
  CAP_DAILY_OVERSPEND,
  CAP_DAILY_ROLLOVER_SUCCESS,
  EVENT_DAILY_OVERSPEND,
  EVENT_DAILY_ROLLOVER_SUCCESS,
  EVENT_STREAK_FREEZE_USED,
  EVENT_STREAK_MILESTONE,
  POINTS_DAILY_OVERSPEND,
  POINTS_DAILY_ROLLOVER_SUCCESS,
  POINTS_STREAK_MILESTONE,
  ROLLOVER_CATCHUP_DAYS,
  STREAK_GRACE_FREEZES_PER_MONTH,
  STREAK_MILESTONES,
} from './rollover.constants';
import {
  catchupDateIsos,
  effectiveDailyCap,
  planDayRollover,
  utcDayBounds,
  type DayRolloverPlan,
} from './rollover-planner';
import {
  collectFreezeUsedDates,
  collectSuccessDates,
  computeStreak,
  type StreakSummary,
} from './streak';

function payloadRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

export interface RolloverDayResult {
  date: string;
  skipped: boolean;
  skipReason?: string;
  amount: number;
  allUnderCap: boolean;
  movements: Array<{ fromPocketId: string; fromPocketName: string; amount: number }>;
  eventType?: string;
  pointsApplied?: number;
}

export interface RolloverRunResult {
  days: RolloverDayResult[];
  totalAmount: number;
  /** Most recent catch-up day's rolled amount (what home "Today's rollover" shows). */
  latestAmount: number;
  streak: StreakSummary;
  milestoneAwarded: number | null;
}

@Injectable()
export class RolloverService {
  private readonly logger = new Logger(RolloverService.name);

  constructor(
    private readonly repository: SupabaseRepository,
    private readonly disciplineScore: DisciplineScoreService,
    private readonly pushDelivery: PushDeliveryService,
  ) {}

  async runForUser(userId: string, now = new Date()): Promise<RolloverRunResult> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      throw new NotFoundException('No active plan found');
    }

    const pockets = await this.repository.getPocketsByPlanId(plan.id);
    const spendable = pockets.filter((p) => p.kind === 'spendable');
    const savings = pockets.find((p) => p.kind === 'savings');

    if (spendable.length === 0) {
      return {
        days: [],
        totalAmount: 0,
        latestAmount: 0,
        streak: await this.getStreak(userId, now),
        milestoneAwarded: null,
      };
    }

    const dates = catchupDateIsos(now, ROLLOVER_CATCHUP_DAYS);
    const lookbackStart = `${dates[0]}T00:00:00.000Z`;
    const priorEvents = await this.repository.getBehaviorEventsByTypesSince(
      userId,
      [EVENT_DAILY_ROLLOVER_SUCCESS, EVENT_DAILY_OVERSPEND, EVENT_STREAK_FREEZE_USED, EVENT_STREAK_MILESTONE],
      lookbackStart,
    );

    const alreadyHandled = new Set<string>();
    for (const event of priorEvents) {
      if (event.type !== EVENT_DAILY_ROLLOVER_SUCCESS && event.type !== EVENT_DAILY_OVERSPEND) continue;
      const payload = payloadRecord(event.payload);
      const d = typeof payload.date === 'string' ? payload.date : event.created_at.slice(0, 10);
      alreadyHandled.add(d);
    }

    const dayResults: RolloverDayResult[] = [];
    let totalAmount = 0;
    let latestAmount = 0;

    for (const dateIso of dates) {
      if (alreadyHandled.has(dateIso)) {
        dayResults.push({
          date: dateIso,
          skipped: true,
          skipReason: 'already_processed',
          amount: 0,
          allUnderCap: true,
          movements: [],
        });
        continue;
      }

      const result = await this.processDay(userId, dateIso, spendable, savings);
      dayResults.push(result);
      if (!result.skipped) {
        totalAmount += result.amount;
        latestAmount = result.amount;
        alreadyHandled.add(dateIso);
      }
    }

    const streakBeforeMilestone = await this.getStreak(userId, now);
    const milestoneAwarded = await this.maybeAwardMilestone(userId, streakBeforeMilestone);
    const streak = milestoneAwarded ? await this.getStreak(userId, now) : streakBeforeMilestone;

    // Batch 7: fire-and-forget pushes. Failures must not fail the rollover.
    await this.dispatchRolloverPushes(userId, dayResults, latestAmount, milestoneAwarded).catch(
      (err) => {
        this.logger.warn(
          `rollover push dispatch failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      },
    );

    return {
      days: dayResults,
      totalAmount,
      latestAmount,
      streak,
      milestoneAwarded,
    };
  }

  private async dispatchRolloverPushes(
    userId: string,
    dayResults: RolloverDayResult[],
    latestAmount: number,
    milestoneAwarded: number | null,
  ): Promise<void> {
    if (milestoneAwarded != null) {
      await this.pushDelivery.notifyStreakMilestone(
        userId,
        milestoneAwarded,
        new Date().toISOString().slice(0, 10),
      );
    }

    const latestSuccess = [...dayResults]
      .reverse()
      .find((d) => !d.skipped && d.eventType === EVENT_DAILY_ROLLOVER_SUCCESS && d.amount > 0);
    if (latestSuccess && latestAmount > 0) {
      await this.pushDelivery.notifyRolloverSuccess(
        userId,
        latestSuccess.date,
        latestSuccess.amount,
      );
    }
  }

  async getStreak(userId: string, now = new Date()): Promise<StreakSummary> {
    const todayIso = now.toISOString().slice(0, 10);
    const since = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 90 * 86400000,
    ).toISOString();
    const events = await this.repository.getBehaviorEventsByTypesSince(
      userId,
      [EVENT_DAILY_ROLLOVER_SUCCESS, EVENT_STREAK_FREEZE_USED],
      since,
    );

    const monthPrefix = todayIso.slice(0, 7);
    const monthFreezeEvents = events.filter(
      (e) => e.type === EVENT_STREAK_FREEZE_USED && e.created_at.startsWith(monthPrefix),
    );

    return computeStreak({
      successDates: collectSuccessDates(
        events.map((e) => ({ type: e.type, payload: payloadRecord(e.payload), created_at: e.created_at })),
      ),
      todayIso,
      freezesAvailable: STREAK_GRACE_FREEZES_PER_MONTH,
      freezeUsedDates: collectFreezeUsedDates(
        monthFreezeEvents.map((e) => ({
          type: e.type,
          payload: payloadRecord(e.payload),
          created_at: e.created_at,
        })),
      ),
    });
  }

  /** Month-to-date rollover credits into Savings (for home display fallback). */
  async getMonthToDateRollover(userId: string, now = new Date()): Promise<number> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) return 0;
    const pockets = await this.repository.getPocketsByPlanId(plan.id);
    const savings = pockets.find((p) => p.kind === 'savings');
    if (!savings) return 0;

    const monthStart = `${now.toISOString().slice(0, 7)}-01T00:00:00.000Z`;
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
    return this.repository.getRolloverCreditsForPocketBetween(savings.id, monthStart, nextMonth);
  }

  private async processDay(
    userId: string,
    dateIso: string,
    spendable: Array<{
      id: string;
      name: string;
      daily_cap: number | null;
      monthly_allocation: number;
    }>,
    savings: { id: string; name: string } | undefined,
  ): Promise<RolloverDayResult> {
    const { startIso, endIsoExclusive } = utcDayBounds(dateIso);
    const pocketIds = spendable.map((p) => p.id);
    const spendTotals = await this.repository.getSpendTotalsByPocketBetween(
      pocketIds,
      startIso,
      endIsoExclusive,
    );

    const inputs = [];
    for (const pocket of spendable) {
      const summary = await this.repository.getPocketSummary(pocket.id);
      inputs.push({
        pocketId: pocket.id,
        pocketName: pocket.name,
        dailyCap: effectiveDailyCap(pocket, dateIso),
        spent: spendTotals.get(pocket.id) || 0,
        available: summary.available,
      });
    }

    const dayPlan: DayRolloverPlan = planDayRollover(dateIso, inputs);

    // Overspend day: no ledger moves, score penalty, breaks the under-cap streak.
    if (dayPlan.anyOverspend) {
      const pointsApplied = await this.applyCappedDelta(
        userId,
        EVENT_DAILY_OVERSPEND,
        POINTS_DAILY_OVERSPEND,
        CAP_DAILY_OVERSPEND,
        dateIso,
      );
      await this.repository.createBehaviorEvent({
        user_id: userId,
        type: EVENT_DAILY_OVERSPEND,
        payload: {
          date: dateIso,
          pockets: dayPlan.pockets.map((p) => ({
            pocket_id: p.pocketId,
            spent: p.spent,
            daily_cap: p.dailyCap,
            overspent: p.overspent,
          })),
          points_deducted: pointsApplied < 0 ? -pointsApplied : 0,
        },
      });
      return {
        date: dateIso,
        skipped: false,
        amount: 0,
        allUnderCap: false,
        movements: [],
        eventType: EVENT_DAILY_OVERSPEND,
        pointsApplied,
      };
    }

    if (dayPlan.totalRollAmount > 0 && !savings) {
      throw new BadRequestException('No savings pocket to receive daily rollover');
    }

    const movements: RolloverDayResult['movements'] = [];
    const ledgerRows: Array<{
      pocket_id: string;
      amount: number;
      type: 'rollover';
      merchant: null;
      category: null;
    }> = [];

    for (const pocket of dayPlan.pockets) {
      if (pocket.rollAmount <= 0) continue;
      movements.push({
        fromPocketId: pocket.pocketId,
        fromPocketName: pocket.pocketName,
        amount: pocket.rollAmount,
      });
      ledgerRows.push({
        pocket_id: pocket.pocketId,
        amount: -pocket.rollAmount,
        type: 'rollover',
        merchant: null,
        category: null,
      });
      ledgerRows.push({
        pocket_id: savings!.id,
        amount: pocket.rollAmount,
        type: 'rollover',
        merchant: null,
        category: null,
      });
    }

    if (ledgerRows.length > 0) {
      await this.repository.createTransactions(ledgerRows);
    }

    const pointsApplied = await this.applyCappedDelta(
      userId,
      EVENT_DAILY_ROLLOVER_SUCCESS,
      POINTS_DAILY_ROLLOVER_SUCCESS,
      CAP_DAILY_ROLLOVER_SUCCESS,
      dateIso,
    );

    await this.repository.createBehaviorEvent({
      user_id: userId,
      type: EVENT_DAILY_ROLLOVER_SUCCESS,
      payload: {
        date: dateIso,
        amount: dayPlan.totalRollAmount,
        movements,
        points_added: pointsApplied > 0 ? pointsApplied : 0,
      },
    });

    return {
      date: dateIso,
      skipped: false,
      amount: dayPlan.totalRollAmount,
      allUnderCap: true,
      movements,
      eventType: EVENT_DAILY_ROLLOVER_SUCCESS,
      pointsApplied,
    };
  }

  private async maybeAwardMilestone(
    userId: string,
    streak: StreakSummary,
  ): Promise<number | null> {
    if (!streak.hitMilestone) return null;

    const since = new Date(Date.now() - 120 * 86400000).toISOString();
    const lifetime = await this.repository.getBehaviorEventsByTypesSince(
      userId,
      [EVENT_STREAK_MILESTONE],
      since,
    );
    if (lifetime.some((e) => Number(payloadRecord(e.payload).days) === streak.hitMilestone)) {
      return null;
    }

    await this.disciplineScore.applyDelta(userId, POINTS_STREAK_MILESTONE);
    await this.repository.createBehaviorEvent({
      user_id: userId,
      type: EVENT_STREAK_MILESTONE,
      payload: {
        days: streak.hitMilestone,
        points_added: POINTS_STREAK_MILESTONE,
        milestones: [...STREAK_MILESTONES],
      },
    });
    return streak.hitMilestone;
  }

  /**
   * Apply a signed delta but respect a per-event-type monthly cap
   * (positive cap = max bonus; negative cap = most negative penalty).
   */
  private async applyCappedDelta(
    userId: string,
    eventType: string,
    points: number,
    monthlyCap: number,
    dateIso: string,
  ): Promise<number> {
    const monthStart = `${dateIso.slice(0, 7)}-01T00:00:00.000Z`;
    const events = await this.repository.getBehaviorEventsByTypesSince(
      userId,
      [eventType],
      monthStart,
    );

    let earned = 0;
    for (const event of events) {
      const payload = payloadRecord(event.payload);
      if (typeof payload.points_added === 'number') earned += payload.points_added;
      if (typeof payload.points_deducted === 'number') earned -= payload.points_deducted;
    }

    let apply = points;
    if (points > 0) {
      apply = Math.min(points, Math.max(0, monthlyCap - earned));
    } else if (points < 0) {
      apply = Math.max(points, Math.min(0, monthlyCap - earned));
    }

    if (apply !== 0) {
      await this.disciplineScore.applyDelta(userId, apply);
    }
    return apply;
  }
}
