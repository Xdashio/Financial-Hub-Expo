import { Injectable } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DEFAULT_SCORE } from './discipline-score.constants';

// Previously there were two independent, disconnected discipline-score
// mechanisms in the codebase:
//   1. PocketsService.calculateDisciplineScore() — derived locally, on the
//      fly, from behavior_events, and used only for time-lock unlock/extend.
//   2. The `discipline_scores` table — written by ReallocationsService when
//      a cooling-off skip is applied, read by InsightsService for the
//      Insights screen.
// They disagreed with each other by construction (different inputs, no
// shared state), so a user could see two different discipline scores on
// two different screens after the same action. See
// BACKEND_FRONTEND_AUDIT.md's "Unify the two disconnected discipline-score
// mechanisms" action item.
//
// This service is now the single source of truth: every discipline-score
// read or write in the app goes through the `discipline_scores` table via
// this service, whether the change originates from a reallocation
// cooling-off skip, an early pocket unlock, or a lock extension.

export interface DisciplineScoreChange {
  previousScore: number | null;
  newScore: number;
}

export interface DisciplineScoreWithContext {
  score: number | null;
  period: string;
  hasHistory: boolean;
}

@Injectable()
export class DisciplineScoreService {
  constructor(private readonly repo: SupabaseRepository) {}

  /** Current score for the user with period context. Returns null for new users. */
  async getCurrentScoreWithContext(userId: string): Promise<DisciplineScoreWithContext> {
    const latest = await this.repo.getLatestDisciplineScore(userId);
    if (!latest) {
      return {
        score: DEFAULT_SCORE,
        period: this.currentPeriod(),
        hasHistory: false,
      };
    }
    return {
      score: latest.score,
      period: latest.period,
      hasHistory: true,
    };
  }

  /** Current score for the user, defaulting to DEFAULT_SCORE with no history. */
  async getCurrentScore(userId: string): Promise<number | null> {
    const latest = await this.repo.getLatestDisciplineScore(userId);
    return latest?.score ?? DEFAULT_SCORE;
  }

  /**
   * Get score history for a date range for trend analysis.
   */
  async getScoreHistory(userId: string, startDate: string, endDate: string): Promise<any[]> {
    return this.repo.getDisciplineScoreHistory(userId, startDate, endDate);
  }

  /**
   * Applies a signed delta (positive = bonus, negative = cost) to the
   * user's current-period discipline score and persists the result.
   * If no score exists (null), starts from 0 and applies the delta.
   * Allows negative scores to show below-baseline discipline performance.
   */
  async applyDelta(userId: string, delta: number): Promise<DisciplineScoreChange> {
    const previousScore = await this.getCurrentScore(userId);
    const startingScore = previousScore ?? 0;
    const newScore = Math.min(100, startingScore + delta); // Allow negative scores, only cap max at 100

    await this.repo.upsertDisciplineScore({
      user_id: userId,
      score: newScore,
      delta,
      period: this.currentPeriod(),
      calculated_at: new Date().toISOString(),
    });

    return { previousScore, newScore };
  }

  /**
   * Recalculates the current period's score from behavior events.
   * Useful for data migration after logic changes or manual corrections.
   * Starts from 0 and sums all points from events in the current period.
   */
  async recalculateFromEvents(userId: string): Promise<DisciplineScoreChange> {
    const currentPeriod = this.currentPeriod();
    const periodStart = `${currentPeriod}-01T00:00:00.000Z`;
    const periodEnd = `${currentPeriod}-01T00:00:00.000Z`; // This will be updated to next month
    
    // Calculate end of current month
    const [year, month] = currentPeriod.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const periodEndStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`;
    
    const behaviorEvents = await this.repo.getBehaviorEventsBetween(userId, periodStart, periodEndStr);
    
    let totalPoints = 0;
    for (const event of behaviorEvents) {
      const payload = event.payload as any;
      if (typeof payload.points_added === 'number') {
        totalPoints += payload.points_added;
      }
      if (typeof payload.points_deducted === 'number') {
        totalPoints -= payload.points_deducted;
      }
    }
    
    const newScore = Math.min(100, totalPoints); // Allow negative scores, only cap max at 100
    const previousScore = await this.getCurrentScore(userId);
    
    await this.repo.upsertDisciplineScore({
      user_id: userId,
      score: newScore,
      delta: totalPoints - (previousScore ?? 0),
      period: currentPeriod,
      calculated_at: new Date().toISOString(),
    });
    
    return { previousScore, newScore };
  }

  private currentPeriod(): string {
    // Monthly period key, e.g. '2026-08' — consistent with how plan/score
    // history is expected to be bucketed elsewhere in the app.
    return new Date().toISOString().slice(0, 7);
  }
}