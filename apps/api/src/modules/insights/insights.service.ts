import { Injectable } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import { BehaviorEvent } from '../../database/database.types';

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

const BEHAVIOR_EVENTS_LIMIT = 20;

export interface PaginatedBehaviorEvents {
  events: BehaviorEvent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface HeatmapDay {
  date: string; // 'YYYY-MM-DD'
  count: number; // number of behavior events that day
  points: number; // net discipline-relevant point movement that day (from event payloads)
}

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
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const events = await this.supabaseRepo.getBehaviorEventsSince(userId, since.toISOString());

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
    const cursor = new Date(since);
    for (let i = 0; i < days; i++) {
      const iso = cursor.toISOString().slice(0, 10);
      const bucket = byDay.get(iso) ?? { count: 0, points: 0 };
      result.push({ date: iso, count: bucket.count, points: bucket.points });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }
}