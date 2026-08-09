import { Injectable } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';

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

// A freshly onboarded user has no scoring history yet, so changes are
// scored against a full-marks baseline until real history exists.
const DEFAULT_SCORE = 100;

export interface DisciplineScoreChange {
  previousScore: number;
  newScore: number;
}

@Injectable()
export class DisciplineScoreService {
  constructor(private readonly repo: SupabaseRepository) {}

  /** Current score for the user, defaulting to DEFAULT_SCORE with no history. */
  async getCurrentScore(userId: string): Promise<number> {
    const latest = await this.repo.getLatestDisciplineScore(userId);
    return latest?.score ?? DEFAULT_SCORE;
  }

  /**
   * Applies a signed delta (positive = bonus, negative = cost) to the
   * user's current-period discipline score and persists the result.
   */
  async applyDelta(userId: string, delta: number): Promise<DisciplineScoreChange> {
    const previousScore = await this.getCurrentScore(userId);
    const newScore = Math.max(0, Math.min(100, previousScore + delta));

    await this.repo.upsertDisciplineScore({
      user_id: userId,
      score: newScore,
      delta,
      period: this.currentPeriod(),
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
