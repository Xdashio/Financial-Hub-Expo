import { Injectable } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';

export interface DisciplineScoreResult {
  score: number;
  delta: number;
}

// A freshly onboarded user has no behavioral history yet, so there's
// nothing to penalize - start at full marks with no movement. Real
// scoring (from the behavior event log) lands per ROADMAP.md ("Insights
// screen wired to real behavioral event log"); until then this is the
// only source of truth for the discipline score.
const DEFAULT_DISCIPLINE_SCORE: DisciplineScoreResult = { score: 100, delta: 0 };

@Injectable()
export class InsightsService {
  constructor(private readonly supabaseRepo: SupabaseRepository) {}

  async getDisciplineScore(userId: string): Promise<DisciplineScoreResult> {
    const latest = await this.supabaseRepo.getLatestDisciplineScore(userId);
    if (!latest) {
      return DEFAULT_DISCIPLINE_SCORE;
    }
    return { score: latest.score, delta: latest.delta };
  }
}