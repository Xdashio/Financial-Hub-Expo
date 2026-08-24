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
  async getRunwayForPlan(userId: string, plan: { 
    type: string; 
    income_pattern: string; 
    income_interval_days: number | null;
    reserve_balance: number;
    monthly_planning_day: number;
    last_planning_cycle_at: string | null;
  }): Promise<RunwaySummary> {
    if (plan.income_pattern !== 'freelancer' || plan.type !== 'daily') {
      return { applicable: false };
    }

    const events = await this.repo.getIncomeEventsByUserId(userId);
    
    // Get fixed obligations for this user
    const fixedExpenses = await this.repo.getFixedExpensesByUserId(userId);
    const activeFixedExpenses = fixedExpenses.filter(f => f.status === 'active');
    const totalFixedObligations = activeFixedExpenses.reduce(
      (sum, f) => sum + Number(f.amount), 
      0
    );

    // Compute daily budget using the same logic as the Monthly Planning Cycle:
    // dailyBudget = max(1, round(discretionaryReserve / 30 * 100) / 100)
    // where discretionaryReserve = reserveBalance - totalFixedObligations
    const reserveBalance = plan.reserve_balance || 0;
    const discretionaryReserve = Math.max(0, reserveBalance - totalFixedObligations);
    const dailyBudget = Math.max(1, Math.round(discretionaryReserve / 30 * 100) / 100);

    return computeRunway({
      incomeIntervalDaysEstimate: plan.income_interval_days,
      incomeEvents: events.map(e => ({ date: e.date })),
      today: new Date(),
      reserveBalance,
      fixedObligations: totalFixedObligations,
      dailyBudget,
    });
  }
}