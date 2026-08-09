import { Injectable } from '@nestjs/common';
import { RunwaySummary, Plan } from '@financial-hub/shared';
import { SupabaseRepository } from '../../database/supabase.repository';
import { computeRunway } from './runway.calculator';

@Injectable()
export class RunwayService {
  constructor(private readonly repo: SupabaseRepository) {}

  /**
   * Runway only applies to freelancer + daily plans (PRD §3.2's "adaptive
   * daily budget based on available runway and income timing" promise —
   * see docs/FREELANCER_RUNWAY.md). Salaried and structured plans get
   * `{ applicable: false }` so callers can skip rendering runway UI without
   * having to know the eligibility rule themselves.
   */
  async getRunwayForPlan(userId: string, plan: { type: string; income_pattern: string; income_interval_days: number | null }): Promise<RunwaySummary> {
    if (plan.income_pattern !== 'freelancer' || plan.type !== 'daily') {
      return { applicable: false };
    }

    const events = await this.repo.getIncomeEventsByUserId(userId);

    return computeRunway({
      incomeIntervalDaysEstimate: plan.income_interval_days,
      incomeEvents: events.map(e => ({ date: e.date })),
      today: new Date(),
    });
  }
}