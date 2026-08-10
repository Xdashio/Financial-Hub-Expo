import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import { BehaviorEvent } from '../../database/database.types';
import { DEFAULT_SCORE } from '../discipline-score/discipline-score.service';

export interface DisciplineScoreResult {
  score: number;
  delta: number;
}

// A freshly onboarded user has no behavioral history yet, so there's
// nothing to penalize - start at full marks with no movement. Imports
// DEFAULT_SCORE from DisciplineScoreService rather than hardcoding its own
// copy of 100 — this used to be a second, independent literal that could
// silently drift from the one DisciplineScoreService actually uses to seed
// applyDelta(), which would make this endpoint and every score-mutating
// action disagree about a fresh user's starting score.
const DEFAULT_DISCIPLINE_SCORE: DisciplineScoreResult = { score: DEFAULT_SCORE, delta: 0 };

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
}