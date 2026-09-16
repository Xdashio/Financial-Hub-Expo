import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import type { Pocket } from '../../database/database.types';
import {
  EmergencyUnlockEligibilityResponse,
  EmergencyUnlockRequest,
  EmergencyUnlockResponse,
  EmergencyUnlockEligibilityReason,
  RunwayImpactOption,
  DiscretionaryRunway,
} from '@financial-hub/shared';
import { SpendingAnalysisService } from '../insights/spending-analysis.service';
import { randomUUID } from 'crypto';
import { sumMoney, toCents, fromCents } from '@financial-hub/shared';

const MINIMUM_HISTORY_DAYS = 7;
const MAX_EMERGENCY_PERCENTAGE = 0.5; // Max 50% of discretionary runway
const MIN_RUNWAY_DAYS = 3; // Floor from runway calculator

function generateUUID(): string {
  return randomUUID();
}

function round2(n: number): number {
  return fromCents(toCents(n));
}

@Injectable()
export class EmergencyUnlockService {
  constructor(
    private readonly repository: SupabaseRepository,
    private readonly spendingAnalysis: SpendingAnalysisService,
  ) {}

  /**
   * Check if user is eligible for emergency unlock and return analysis data.
   * Uses runway-impact model: shows how emergency allocation affects spending runway.
   * Only available for freelancer + daily plans.
   */
  async checkEligibility(userId: string, planId: string): Promise<EmergencyUnlockEligibilityResponse> {
    // Get the plan to verify it's a freelancer + daily plan
    const plan = await this.repository.getPlanById(planId);
    if (!plan) {
      return {
        eligible: false,
        reason: 'not_freelancer_plan',
        message: 'Plan not found.',
      };
    }

    if (plan.income_pattern !== 'freelancer' || plan.type !== 'daily') {
      return {
        eligible: false,
        reason: 'not_freelancer_plan',
        message: 'Emergency unlock is only available for Freelancer Daily Budget plans.',
      };
    }

    // Check if user has any pockets with allocations
    const pockets = await this.repository.getTopLevelPocketsByPlanId(planId);
    if (pockets.length === 0) {
      return {
        eligible: false,
        reason: 'no_discretionary_runway',
        message: 'No pockets found. Please set up your budget first.',
      };
    }

    // Check monthly limit
    const thisMonthUnlock = await this.repository.getEmergencyUnlockThisMonth(userId);
    if (thisMonthUnlock) {
      const nextMonth = new Date(thisMonthUnlock.created_at);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);

      return {
        eligible: false,
        reason: 'monthly_limit_reached',
        message: 'You can only use emergency unlock once per month.',
        last_used: thisMonthUnlock.created_at,
        next_available: nextMonth.toISOString(),
      };
    }

    // Analyze spending patterns
    const analysis = await this.spendingAnalysis.analyze30DaySpending(userId, planId);

    // Check if user has sufficient history
    if (!this.spendingAnalysis.hasSufficientHistory(analysis)) {
      return {
        eligible: false,
        reason: 'insufficient_history',
        message: 'Not enough spending data yet to calculate safe amounts. Continue logging spends for a few more days to unlock this feature.',
      };
    }

    // Calculate discretionary runway (reserve - fixed obligations)
    // Segment-scoped to Individual so MSME bills don't deflate runway (016)
    const fixedExpenses = await this.repository.getFixedExpensesByUserId(userId, 'individual');
    const activeFixedExpenses = fixedExpenses.filter(f => f.status === 'active');
    const totalFixedObligations = activeFixedExpenses.reduce(
      (sum, f) => sum + Number(f.amount), 
      0
    );

    const reserveBalance = plan.reserve_balance || 0;
    const discretionaryReserve = Math.max(0, reserveBalance - totalFixedObligations);
    
    // Get daily budget from plan or compute from reserve
    const dailyBudget = Math.max(1, Math.round(reserveBalance / 30 * 100) / 100);
    const runwayDays = dailyBudget > 0 ? Math.floor(discretionaryReserve / dailyBudget) : MIN_RUNWAY_DAYS;

    if (runwayDays <= MIN_RUNWAY_DAYS) {
      return {
        eligible: false,
        reason: 'no_discretionary_runway',
        message: 'Your discretionary runway is too low for an emergency allocation.',
        analysis: {
          least_daily_spend: analysis.least_daily_spend,
          most_daily_spend: analysis.most_daily_spend,
          average_daily_spend: analysis.average_daily_spend,
          days_of_history: analysis.days_of_history,
        },
        discretionary_runway: {
          total_reserve: reserveBalance,
          fixed_obligations: totalFixedObligations,
          discretionary_reserve: discretionaryReserve,
          daily_budget: dailyBudget,
          runway_days: runwayDays,
        },
      };
    }

    // Generate runway impact options for the UI slider
    const runwayImpactOptions = this.generateRunwayImpactOptions(
      discretionaryReserve,
      dailyBudget,
      runwayDays,
      analysis.average_daily_spend,
    );

    return {
      eligible: true,
      analysis: {
        least_daily_spend: analysis.least_daily_spend,
        most_daily_spend: analysis.most_daily_spend,
        average_daily_spend: analysis.average_daily_spend,
        days_of_history: analysis.days_of_history,
      },
      discretionary_runway: {
        total_reserve: reserveBalance,
        fixed_obligations: totalFixedObligations,
        discretionary_reserve: discretionaryReserve,
        daily_budget: dailyBudget,
        runway_days: runwayDays,
      },
      runway_impact_options: runwayImpactOptions,
    };
  }

  /**
   * Execute emergency unlock with selected amount.
   * Uses runway-impact model: reduces discretionary runway, records impact.
   */
  async executeUnlock(
    userId: string,
    planId: string,
    request: EmergencyUnlockRequest,
  ): Promise<EmergencyUnlockResponse> {
    // Re-check eligibility
    const eligibility = await this.checkEligibility(userId, planId);
    if (!eligibility.eligible) {
      return {
        applied: false,
        error: eligibility.reason,
        message: eligibility.message,
        next_available: eligibility.next_available,
      };
    }

    const { discretionary_runway, runway_impact_options } = eligibility;
    if (!discretionary_runway || !runway_impact_options) {
      return {
        applied: false,
        error: 'insufficient_data',
        message: 'Could not retrieve runway data.',
      };
    }

    // Validate amount is within allowed range (max 50% of discretionary runway)
    const maxEmergency = discretionary_runway.discretionary_reserve * MAX_EMERGENCY_PERCENTAGE;
    if (request.amount > maxEmergency) {
      return {
        applied: false,
        error: 'amount_exceeds_max_percentage',
        message: `Emergency amount cannot exceed 50% of your discretionary runway (KSh ${maxEmergency.toFixed(0)}).`,
      };
    }

    // Check user confirmed the runway impact
    if (!request.confirm_impact) {
      return {
        applied: false,
        error: 'impact_not_confirmed',
        message: 'You must confirm you understand the impact on your spending runway.',
      };
    }

    // Find the selected option to get runway impact values
    const selectedOption = runway_impact_options.find(
      o => o.emergency_amount === request.amount
    ) || this.calculateRunwayImpact(
      request.amount,
      discretionary_runway.discretionary_reserve,
      discretionary_runway.daily_budget,
      discretionary_runway.runway_days,
    );

    // Get plan and savings pocket
    const plan = await this.repository.getPlanById(planId);
    if (!plan) {
      return {
        applied: false,
        error: 'plan_not_found',
        message: 'Plan not found.',
      };
    }

    const pockets = await this.repository.getTopLevelPocketsByPlanId(planId);
    const savingsPocket = pockets.find((p) => p.kind === 'savings');

    if (!savingsPocket) {
      return {
        applied: false,
        error: 'no_savings_pocket',
        message: 'Savings pocket not found.',
      };
    }

    // Verify savings has enough balance (emergency comes from savings)
    const savingsSummary = await this.repository.getPocketSummary(savingsPocket.id);
    if (savingsSummary.available < request.amount) {
      return {
        applied: false,
        error: 'savings_insufficient',
        message: 'Insufficient balance in savings pocket.',
      };
    }

    // Create the unlock event, the savings debit, and the reserve shrink in
    // one database transaction (H1, migration 031): a failure on any step no
    // longer leaves an orphaned unlock record with no money actually moving.
    // The database's one-per-month unique index also rejects a concurrent
    // same-month unlock inside the same transaction.
    const unlockId = generateUUID();
    const committed = await this.repository.executeEmergencyUnlockAtomic({
      id: unlockId,
      userId,
      planId,
      amount: request.amount,
      daysCalculated: selectedOption.runway_reduction_days,
      leastDailySpend: eligibility.analysis?.least_daily_spend ?? 0,
      averageDailySpend: eligibility.analysis?.average_daily_spend ?? 0,
      reserveKept: savingsSummary.available - request.amount,
      runwayDaysBefore: selectedOption.runway_days_before,
      runwayDaysAfter: selectedOption.runway_days_after,
      runwayReductionDays: selectedOption.runway_reduction_days,
      savingsPocketId: savingsPocket.id,
    });

    // A concurrent unlock slipped past checkEligibility and won the monthly
    // slot first — the DB's unique index rejected this one (atomic rollback).
    if (!committed) {
      return {
        applied: false,
        error: 'monthly_limit_reached',
        message: 'You can only use emergency unlock once per month.',
      };
    }

    // Calculate next available date
    const nextAvailable = new Date();
    nextAvailable.setMonth(nextAvailable.getMonth() + 1);
    nextAvailable.setDate(1);
    nextAvailable.setHours(0, 0, 0, 0);

    return {
      applied: true,
      unlock: {
        id: unlockId,
        amount: request.amount,
        runway_days_before: selectedOption.runway_days_before,
        runway_days_after: selectedOption.runway_days_after,
        runway_reduction_days: selectedOption.runway_reduction_days,
        allocations: [{
          pocket_id: savingsPocket.id,
          pocket_name: savingsPocket.name,
          amount: request.amount,
          percentage: 100,
        }],
      },
      next_available: nextAvailable.toISOString(),
    };
  }

  /**
   * Generate runway impact options for the UI slider.
   * Shows user the trade-off between emergency amount and runway days.
   */
  private generateRunwayImpactOptions(
    discretionaryReserve: number,
    dailyBudget: number,
    currentRunwayDays: number,
    avgDailySpend: number,
  ): RunwayImpactOption[] {
    const options: RunwayImpactOption[] = [];
    
    // Generate options at different percentages of discretionary reserve
    const percentages = [0.1, 0.2, 0.3, 0.4, 0.5]; // 10% to 50%
    
    for (const pct of percentages) {
      const emergencyAmount = round2(discretionaryReserve * pct);
      if (emergencyAmount <= 0) continue;
      
      const impact = this.calculateRunwayImpact(
        emergencyAmount,
        discretionaryReserve,
        dailyBudget,
        currentRunwayDays,
      );
      
      options.push(impact);
    }

    return options;
  }

  /**
   * Calculate the runway impact of an emergency allocation.
   */
  private calculateRunwayImpact(
    emergencyAmount: number,
    discretionaryReserve: number,
    dailyBudget: number,
    currentRunwayDays: number,
  ): RunwayImpactOption {
    const newDiscretionaryReserve = Math.max(0, discretionaryReserve - emergencyAmount);
    const newRunwayDays = dailyBudget > 0 
      ? Math.floor(newDiscretionaryReserve / dailyBudget)
      : MIN_RUNWAY_DAYS;
    
    const runwayReduction = currentRunwayDays - newRunwayDays;

    return {
      emergency_amount: emergencyAmount,
      runway_days_before: currentRunwayDays,
      runway_days_after: Math.max(MIN_RUNWAY_DAYS, newRunwayDays),
      runway_reduction_days: Math.max(0, runwayReduction),
    };
  }
}