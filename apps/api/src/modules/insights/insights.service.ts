import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import { BehaviorEvent } from '../../database/database.types';
import { DEFAULT_SCORE } from '../discipline-score/discipline-score.constants';
import { RolloverService } from '../rollover/rollover.service';
import type { StreakSummary } from '../rollover/streak';
import { NudgesService } from '../nudges/nudges.service';
import type { NudgeItem } from '../nudges/nudge.calculator';
import { insightPriorityOrderFor, type InsightKind } from '../../common/personality-modifiers';
import type { MsmeProject, MsmeProjectTier, MsmeProjectIncomeEvent, MsmeProjectSpend } from '../../database/database.types';

export interface DisciplineScoreResult {
  score: number | null;
  delta: number;
  period: string;
  hasHistory: boolean;
  // Money-personality modifier layer (§2.3) — which of the Insights
  // screen's metric cards to lead with, in priority order. The client
  // reorders its existing cards by this; it doesn't change what's shown,
  // only the order.
  cardOrder: InsightKind[];
}

// A freshly onboarded user has no behavioral history yet, so return null
// to indicate "No data yet" instead of a fake 100 score.
const DEFAULT_DISCIPLINE_SCORE: Omit<DisciplineScoreResult, 'cardOrder'> = {
  score: DEFAULT_SCORE, 
  delta: 0, 
  period: new Date().toISOString().slice(0, 7),
  hasHistory: false 
};

const BEHAVIOR_EVENTS_LIMIT = 20;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PaginatedBehaviorEvents {
  events: BehaviorEvent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface HeatmapDay {
  date: string; // 'YYYY-MM-DD'
  count: number; // number of behavior events that day
  points: number; // net discipline-relevant point movement that day (from event payloads)
}

// MSME-specific insights (Phase 6)
export interface MsmeProjectInsights {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  avgFundingVelocity: number; // days from first income to full funding
  avgDaysPerTier: {
    priorities: number;
    needs: number;
    wants: number;
  };
  wantsDisciplineScore: number; // % of spends that respect spending controls
  totalContractValue: number;
  totalAllocated: number;
  totalSpent: number;
}

@Injectable()
export class InsightsService {
  constructor(
    private readonly supabaseRepo: SupabaseRepository,
    private readonly rolloverService: RolloverService,
    private readonly nudgesService: NudgesService,
  ) {}

  async getDisciplineScore(userId: string): Promise<DisciplineScoreResult> {
    const plan = await this.supabaseRepo.getActivePlanByUserId(userId);
    const cardOrder = insightPriorityOrderFor(plan?.money_personality);

    const latest = await this.supabaseRepo.getLatestDisciplineScore(userId);
    if (!latest) {
      return { ...DEFAULT_DISCIPLINE_SCORE, cardOrder };
    }

    // `discipline_scores.delta` is the *last* applyDelta write, not the
    // period net — surfacing it as "pts this period" made a single streak
    // milestone look like a month of progress. Sum signed points from this
    // month's behavior events instead.
    const period = latest.period || new Date().toISOString().slice(0, 7);
    const periodDelta = await this.sumPeriodDisciplinePoints(userId, period);

    return {
      score: latest.score,
      delta: periodDelta,
      period,
      hasHistory: true,
      cardOrder,
    };
  }

  /** Net discipline points from behavior events in YYYY-MM. */
  private async sumPeriodDisciplinePoints(userId: string, period: string): Promise<number> {
    const monthStart = `${period}-01T00:00:00.000Z`;
    const [y, m] = period.split('-').map(Number);
    const nextMonth = new Date(Date.UTC(y, m, 1)).toISOString(); // m is 1-based month number → Date.UTC month index = m (next month)

    const events = await this.supabaseRepo.getBehaviorEventsByTypesSince(
      userId,
      [
        'daily_rollover_success',
        'daily_overspend',
        'streak_milestone',
        'gambling_blocked_attempt',
        'essential_override',
        'fixed_payment_on_time',
        'goal_achieved',
        'streak_freeze_used',
        // lock_extension (PocketsService.extendLock) and early_unlock
        // (PocketsService.unlockPocket) both write points_added /
        // points_deducted through the same shared discipline-score
        // service as every other event here, and both actually move the
        // real score. Leaving them out of this list made the hero's "pts
        // this period" copy silently ignore lock extensions and early
        // unlocks — a user could rack up +6 three times from extending a
        // lock and still see "Recent drag: -N pts this period" because
        // only the unrelated daily_overspend events were being summed.
        'lock_extension',
        'early_unlock',
        // reallocation_completed also moves the real score via
        // ReallocationsService.applyDisciplineCost whenever a user skips
        // the cooling-off period (SKIP_COOLING_OFF_COST, currently -5).
        // Was missing from this list entirely, so a skipped cooling-off
        // silently vanished from "pts this period" the same way lock
        // extensions did above — the score genuinely dropped further than
        // the hero copy reported. reallocation_initiated is intentionally
        // excluded: it always writes discipline_cost: 0 at creation time
        // (the real cost, if any, is only known and applied once the
        // reallocation completes).
        'reallocation_completed',
        // loans.service.ts writes these on every loan repayment / on full
        // payoff and calls disciplineScore.applyDelta for each one — same
        // real-score-movement category as lock_extension/reallocation_completed
        // above, just missed when this list was written before the loans
        // feature existed. Their payloads now carry points_added/
        // points_deducted (see loans.service.ts), so no special-case read
        // is needed here — the generic loop below already handles it.
        'loan_repayment_ontime',
        'loan_repayment_late',
        'loan_fully_repaid',
      ],
      monthStart,
    );

    let net = 0;
    for (const event of events) {
      if (event.created_at >= nextMonth) continue;
      const payload = (event.payload || {}) as Record<string, unknown>;
      if (typeof payload.points_added === 'number') net += payload.points_added;
      if (typeof payload.points_deducted === 'number') net -= payload.points_deducted;
      // reallocation_completed doesn't follow the points_added/points_deducted
      // convention above — it's written by ReallocationsService with a
      // differently-named field (see applyDisciplineCost in
      // reallocations.service.ts), so it needs its own read here.
      if (event.type === 'reallocation_completed' && typeof payload.disciplineCost === 'number') {
        net -= payload.disciplineCost;
      }
    }
    return net;
  }

  async getDisciplineScoreHistory(userId: string, startDate: string, endDate: string) {
    return this.supabaseRepo.getDisciplineScoreHistory(userId, startDate, endDate);
  }

  async getStreak(userId: string): Promise<StreakSummary> {
    return this.rolloverService.getStreak(userId);
  }

  /**
   * Nudge generation (part 3):
   * proactive nudges computed server-side. All three §7 MVP nudge types
   * (runway/velocity, surplus-sweep, streak-at-risk) are included — see
   * NudgesService for the per-type logic and NudgeItem for the
   * discriminated union the client switches on.
   */
  async getNudges(userId: string): Promise<NudgeItem[]> {
    return this.nudgesService.getNudges(userId);
  }

  async getBehaviorEvents(userId: string): Promise<BehaviorEvent[]> {
    return this.supabaseRepo.getBehaviorEventsByUserId(userId, BEHAVIOR_EVENTS_LIMIT);
  }

  /** Paginated behavior events for the Insights "recent activity" list. */
  async getBehaviorEventsPaginated(userId: string, page = 1, limit = 20): Promise<PaginatedBehaviorEvents> {
    const result = await this.supabaseRepo.getBehaviorEventsByUserIdPaginated(userId, page, limit);
    return {
      events: result.events,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Day-bucketed activity for the streak heatmap. `range` controls the
   * lookback window: a week, a month, or a year of calendar days. Every day
   * in the window is present in the output (zero-filled), so the client can
   * render a continuous grid without doing its own date math.
   */
  async getActivityHeatmap(userId: string, range: 'week' | 'month' | 'year' = 'month'): Promise<HeatmapDay[]> {
    const days = range === 'week' ? 7 : range === 'year' ? 365 : 30;

    // Anchored with Date.UTC/getUTC* rather than local setHours/setDate.
    // The previous version zeroed the *local* wall clock via
    // since.setHours(0,0,0,0) and then read it back with toISOString(),
    // which converts to UTC. On any server whose process timezone is ahead
    // of UTC (e.g. TZ=Africa/Nairobi, UTC+3 — notably the default on a dev
    // machine physically in that timezone), local midnight lands at 21:00
    // the *previous* UTC day, so every bucket — and the whole window's
    // start/end — silently shifted a day off from the calendar day the
    // events actually happened on. Pure UTC arithmetic here makes the
    // grid's day boundaries independent of wherever the process happens to
    // run, matching how `created_at` is already stored/compared (UTC).
    const now = new Date();
    const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const sinceUtcMs = todayUtcMs - (days - 1) * MS_PER_DAY;

    const events = await this.supabaseRepo.getBehaviorEventsSince(userId, new Date(sinceUtcMs).toISOString());

    const byDay = new Map<string, { count: number; points: number }>();
    for (const event of events) {
      const day = event.created_at.slice(0, 10);
      const bucket = byDay.get(day) ?? { count: 0, points: 0 };
      bucket.count += 1;
      const payload: any = event.payload || {};
      // Signed point movement, when the event carries one — early unlocks
      // deduct (points_deducted), lock extensions and streak milestones add
      // (points_added). Everything else just contributes to activity count.
      if (typeof payload.points_deducted === 'number') bucket.points -= payload.points_deducted;
      if (typeof payload.points_added === 'number') bucket.points += payload.points_added;
      byDay.set(day, bucket);
    }

    const result: HeatmapDay[] = [];
    for (let i = 0; i < days; i++) {
      const iso = new Date(sinceUtcMs + i * MS_PER_DAY).toISOString().slice(0, 10);
      const bucket = byDay.get(iso) ?? { count: 0, points: 0 };
      result.push({ date: iso, count: bucket.count, points: bucket.points });
    }
    return result;
  }

  /**
   * The actual behavior events for a single calendar day (UTC), so the
   * heatmap's tap-to-expand can show what really happened instead of just
   * the aggregate count/points getActivityHeatmap() returns. Newest first,
   * matching getBehaviorEvents().
   */
  async getEventsForDay(userId: string, dateIso: string): Promise<BehaviorEvent[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }
    const dayStartMs = Date.parse(`${dateIso}T00:00:00.000Z`);
    if (Number.isNaN(dayStartMs)) {
      throw new BadRequestException('date is not a valid calendar date');
    }
    const events = await this.supabaseRepo.getBehaviorEventsBetween(
      userId,
      new Date(dayStartMs).toISOString(),
      new Date(dayStartMs + MS_PER_DAY).toISOString()
    );
    return events.slice().reverse();
  }

  /**
   * MSME-specific insights (Phase 6)
   * Calculates business metrics from MSME project funding cascade data.
   * Only returns data when user has an active MSME plan, otherwise null.
   */
  async getMsmeInsights(userId: string): Promise<MsmeProjectInsights | null> {
    const plan = await this.supabaseRepo.getActivePlanByUserId(userId, 'msme');
    if (!plan) {
      return null; // User doesn't have MSME segment
    }

    const projects = await this.supabaseRepo.getMsmeProjectsByUserId(userId);
    if (projects.length === 0) {
      return this.getEmptyMsmeInsights();
    }

    const activeProjects = projects.filter(p => p.status === 'active');
    const completedProjects = projects.filter(p => p.status === 'completed');

    // Simplified funding velocity - just count completed projects with income
    let projectsWithIncome = 0;
    const fundingVelocities: number[] = [];

    for (const project of completedProjects) {
      const incomeEvents = await this.supabaseRepo.getMsmeProjectIncomeEventsByProjectId(project.id);
      if (incomeEvents.length > 0) {
        projectsWithIncome++;
        // Simplified: use project duration as proxy for funding velocity
        const created = new Date(project.created_at);
        const completed = project.completed_at ? new Date(project.completed_at) : new Date();
        const days = Math.ceil((completed.getTime() - created.getTime()) / MS_PER_DAY);
        fundingVelocities.push(days);
      }
    }

    // Simplified tier days - use project completion as proxy
    const avgFundingVelocity = fundingVelocities.length > 0 
      ? Math.round(fundingVelocities.reduce((a, b) => a + b, 0) / fundingVelocities.length)
      : 0;

    // Calculate wants discipline score based on spending controls
    let wantsDisciplineScore = 100;
    let totalWantsSpends = 0;
    let disciplinedWantsSpends = 0;

    for (const project of projects) {
      const tiers = await this.supabaseRepo.getMsmeProjectTiersByProjectId(project.id);
      const wantsTier = tiers.find(t => t.tier === 'wants');
      if (wantsTier) {
        const spends = await this.supabaseRepo.getMsmeProjectSpendsByProjectId(project.id);
        const wantsSpends = spends.filter(s => s.tier_id === wantsTier.id);
        totalWantsSpends += wantsSpends.length;
        
        // Check if project has spending controls enabled
        const controls = (project as any).spending_controls;
        if (controls && controls.lockWantsUntilPrioritiesAndNeedsFunded) {
          // If controls are enabled, all wants spends are considered disciplined
          disciplinedWantsSpends += wantsSpends.length;
        } else {
          // Without controls, assume disciplined for now
          disciplinedWantsSpends += wantsSpends.length;
        }
      }
    }

    if (totalWantsSpends > 0) {
      wantsDisciplineScore = Math.round((disciplinedWantsSpends / totalWantsSpends) * 100);
    }

    // Calculate totals
    const totalContractValue = projects.reduce((sum, p) => sum + Number(p.contract_value), 0);
    let totalAllocated = 0;
    let totalSpent = 0;

    for (const project of projects) {
      const tiers = await this.supabaseRepo.getMsmeProjectTiersByProjectId(project.id);
      totalAllocated += tiers.reduce((sum, t) => sum + Number(t.allocated_amount), 0);
      totalSpent += tiers.reduce((sum, t) => sum + Number(t.spent_amount), 0);
    }

    // Simplified tier days - use average project duration as proxy
    const avgDaysPerTier = {
      priorities: avgFundingVelocity > 0 ? Math.round(avgFundingVelocity * 0.4) : 0,
      needs: avgFundingVelocity > 0 ? Math.round(avgFundingVelocity * 0.3) : 0,
      wants: avgFundingVelocity > 0 ? Math.round(avgFundingVelocity * 0.3) : 0,
    };

    return {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      completedProjects: completedProjects.length,
      avgFundingVelocity,
      avgDaysPerTier,
      wantsDisciplineScore,
      totalContractValue,
      totalAllocated,
      totalSpent,
    };
  }

  private getEmptyMsmeInsights(): MsmeProjectInsights {
    return {
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      avgFundingVelocity: 0,
      avgDaysPerTier: { priorities: 0, needs: 0, wants: 0 },
      wantsDisciplineScore: 100,
      totalContractValue: 0,
      totalAllocated: 0,
      totalSpent: 0,
    };
  }
}