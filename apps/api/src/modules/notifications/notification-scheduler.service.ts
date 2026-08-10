import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { PushDeliveryService } from './push-delivery.service';
import { COOLING_OFF_REMINDER_GRACE_MS } from './notification.constants';
import {
  EVENT_DAILY_OVERSPEND,
  EVENT_DAILY_ROLLOVER_SUCCESS,
  EVENT_STREAK_FREEZE_USED,
  STREAK_GRACE_FREEZES_PER_MONTH,
} from '../rollover/rollover.constants';
import {
  collectFreezeUsedDates,
  collectSuccessDates,
  computeStreak,
} from '../rollover/streak';

function payloadRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

/**
 * Batch 7 server-side scheduler.
 *
 * - Cooling-off ready: every minute, notify when a cooling_off window has ended
 * - Streak-at-risk tips: daily 18:00 UTC for users with tips_nudges on
 * - Monthly insights: 1st of each month 09:00 UTC
 *
 * Milestone / rollover / reallocation-confirm pushes are event-driven
 * (see RolloverService / ReallocationsService / IncomeService), not cron.
 *
 * Intentionally does NOT import RolloverService — that would create a
 * circular module dependency (rollover → push → scheduler → rollover).
 * Streak math is shared via the pure `streak.ts` helper instead.
 */
@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private coolingOffRunning = false;
  private tipsRunning = false;
  private monthlyRunning = false;

  constructor(
    private readonly repository: SupabaseRepository,
    private readonly push: PushDeliveryService,
    private readonly disciplineScore: DisciplineScoreService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendCoolingOffReminders(now = new Date()): Promise<{ checked: number; sent: number }> {
    if (this.coolingOffRunning) {
      return { checked: 0, sent: 0 };
    }
    this.coolingOffRunning = true;
    try {
      const windowEnd = now.toISOString();
      const windowStart = new Date(now.getTime() - COOLING_OFF_REMINDER_GRACE_MS).toISOString();
      const ready = await this.repository.getCoolingOffReallocationsEndingBetween(
        windowStart,
        windowEnd,
      );

      let sent = 0;
      for (const row of ready) {
        const userId = await this.repository.resolveUserIdForPocket(row.from_pocket_id);
        if (!userId) continue;
        const result = await this.push.notifyCoolingOffReady(userId, row.id, Number(row.amount));
        if (result.sent) sent += 1;
      }
      if (ready.length > 0) {
        this.logger.log(`cooling-off reminders: checked=${ready.length} sent=${sent}`);
      }
      return { checked: ready.length, sent };
    } finally {
      this.coolingOffRunning = false;
    }
  }

  /**
   * Evening window across timezones: 15:00 / 18:00 / 21:00 UTC covers
   * roughly 18:00–00:00 EAT and similar late-afternoon slots elsewhere.
   * Dedupe key is per calendar day so only one nudge fires.
   */
  @Cron('0 15,18,21 * * *')
  async sendStreakAtRiskNudges(now = new Date()): Promise<{ candidates: number; sent: number }> {
    if (this.tipsRunning) {
      return { candidates: 0, sent: 0 };
    }
    this.tipsRunning = true;
    try {
      const userIds = await this.push.listUserIdsWithPreferenceAndTokens('tips_nudges');
      const todayIso = now.toISOString().slice(0, 10);
      const dayStart = `${todayIso}T00:00:00.000Z`;
      let sent = 0;

      for (const userId of userIds) {
        const todayEvents = await this.repository.getBehaviorEventsByTypesSince(
          userId,
          [EVENT_DAILY_ROLLOVER_SUCCESS, EVENT_DAILY_OVERSPEND],
          dayStart,
        );
        const overspentToday = todayEvents.some((e) => e.type === EVENT_DAILY_OVERSPEND);
        if (overspentToday) continue;

        const streak = await this.computeStreakForUser(userId, now);
        if (streak.currentStreak <= 0) continue;

        const result = await this.push.notifyStreakAtRisk(userId, streak.currentStreak, todayIso);
        if (result.sent) sent += 1;
      }

      this.logger.log(`streak-at-risk nudges: candidates=${userIds.length} sent=${sent}`);
      return { candidates: userIds.length, sent };
    } finally {
      this.tipsRunning = false;
    }
  }

  /** 1st of month, 09:00 UTC. */
  @Cron('0 9 1 * *')
  async sendMonthlyInsights(now = new Date()): Promise<{ candidates: number; sent: number }> {
    if (this.monthlyRunning) {
      return { candidates: 0, sent: 0 };
    }
    this.monthlyRunning = true;
    try {
      const userIds = await this.push.listUserIdsWithPreferenceAndTokens('monthly_insights');
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const period = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
      let sent = 0;

      for (const userId of userIds) {
        const score = await this.disciplineScore.getCurrentScore(userId);
        const result = await this.push.notifyMonthlyInsight(userId, period, score);
        if (result.sent) sent += 1;
      }

      this.logger.log(`monthly insights: candidates=${userIds.length} sent=${sent} period=${period}`);
      return { candidates: userIds.length, sent };
    } finally {
      this.monthlyRunning = false;
    }
  }

  private async computeStreakForUser(userId: string, now: Date) {
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
        events.map((e) => ({
          type: e.type,
          payload: payloadRecord(e.payload),
          created_at: e.created_at,
        })),
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
}
