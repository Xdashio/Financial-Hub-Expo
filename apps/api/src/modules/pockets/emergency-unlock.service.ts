import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import type { Pocket } from '../../database/database.types';
import {
  EmergencyUnlockEligibilityResponse,
  EmergencyUnlockRequest,
  EmergencyUnlockResponse,
  EmergencyUnlockEligibilityReason,
} from '@financial-hub/shared';
import { SpendingAnalysisService } from '../insights/spending-analysis.service';

const MINIMUM_HISTORY_DAYS = 7;
const RESERVE_PERCENTAGE = 0.2; // 20% minimum reserve
const MINIMUM_RESERVE_AMOUNT = 1000; // KSh 1000 minimum absolute reserve

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

@Injectable()
export class EmergencyUnlockService {
  constructor(
    private readonly repository: SupabaseRepository,
    private readonly spendingAnalysis: SpendingAnalysisService,
  ) {}

  /**
   * Check if user is eligible for emergency unlock and return analysis data.
   */
  async checkEligibility(userId: string, planId: string): Promise<EmergencyUnlockEligibilityResponse> {
    // Check if user has any pockets with allocations (not a new user)
    const pockets = await this.repository.getTopLevelPocketsByPlanId(planId);
    if (pockets.length === 0) {
      return {
        eligible: false,
        reason: 'no_depleted_pockets',
        message: 'No pockets found. Please set up your budget first.',
      };
    }

    // Check if all non-savings pockets are depleted
    const nonSavingsPockets = pockets.filter((p) => p.kind !== 'savings');
    const savingsPocket = pockets.find((p) => p.kind === 'savings');

    if (nonSavingsPockets.length === 0) {
      return {
        eligible: false,
        reason: 'no_depleted_pockets',
        message: 'No non-savings pockets found.',
      };
    }

    // Check if all non-savings pockets are depleted
    const nonSavingsPocketIds = nonSavingsPockets.map((p) => p.id);
    const pocketSummaries = await Promise.all(
      nonSavingsPocketIds.map((id) => this.repository.getPocketSummary(id)),
    );

    const allDepleted = pocketSummaries.every((summary) => summary.available <= 0);
    if (!allDepleted) {
      return {
        eligible: false,
        reason: 'no_depleted_pockets',
        message: 'Not all pockets are depleted yet.',
      };
    }

    // Check if savings pocket has balance
    if (!savingsPocket) {
      return {
        eligible: false,
        reason: 'savings_depleted',
        message: 'No savings pocket found.',
      };
    }

    const savingsSummary = await this.repository.getPocketSummary(savingsPocket.id);
    if (savingsSummary.available <= 0) {
      return {
        eligible: false,
        reason: 'savings_depleted',
        message: 'Your savings pocket is currently empty. Emergency unlock requires available savings.',
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
        days_of_history: analysis.days_of_history,
        minimum_required_days: MINIMUM_HISTORY_DAYS,
      };
    }

    // Calculate reserve
    const totalSavings = savingsSummary.available;
    const minimumReserve = this.calculateReserve(totalSavings);
    const availableToUnlock = totalSavings - minimumReserve;

    return {
      eligible: true,
      analysis: {
        least_daily_spend: analysis.least_daily_spend,
        most_daily_spend: analysis.most_daily_spend,
        average_daily_spend: analysis.average_daily_spend,
        days_of_history: analysis.days_of_history,
      },
      savings_reserve: {
        total_savings: totalSavings,
        minimum_reserve: minimumReserve,
        available_to_unlock: availableToUnlock,
      },
    };
  }

  /**
   * Execute emergency unlock with selected amount.
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

    const { analysis, savings_reserve } = eligibility;
    if (!analysis || !savings_reserve) {
      return {
        applied: false,
        error: 'insufficient_data',
        message: 'Could not retrieve analysis or reserve data.',
      };
    }

    // Validate amount is within range
    if (request.amount < analysis.least_daily_spend) {
      return {
        applied: false,
        error: 'amount_below_minimum',
        message: `Amount must be at least KSh ${analysis.least_daily_spend} (your least daily spend)`,
      };
    }

    if (request.amount > analysis.average_daily_spend) {
      return {
        applied: false,
        error: 'amount_above_maximum',
        message: `Amount must not exceed KSh ${analysis.average_daily_spend} (your average daily spend)`,
      };
    }

    if (request.amount > savings_reserve.available_to_unlock) {
      return {
        applied: false,
        error: 'amount_exceeds_available',
        message: `Amount must not exceed KSh ${savings_reserve.available_to_unlock} (available after reserve)`,
      };
    }

    // Check user confirmed reserve
    if (!request.confirm_reserve) {
      return {
        applied: false,
        error: 'reserve_not_confirmed',
        message: 'You must confirm you understand the reserve will be kept in savings.',
      };
    }

    // Get pockets for allocation
    const pockets = await this.repository.getTopLevelPocketsByPlanId(planId);
    const nonSavingsPockets = pockets.filter((p) => p.kind !== 'savings');
    const savingsPocket = pockets.find((p) => p.kind === 'savings');

    if (!savingsPocket) {
      return {
        applied: false,
        error: 'no_savings_pocket',
        message: 'Savings pocket not found.',
      };
    }

    // Calculate proportional allocation
    const allocations = this.calculateProportionalAllocation(
      request.amount,
      nonSavingsPockets,
    );

    // Calculate days lasting
    const daysLasting = this.spendingAnalysis.calculateDaysLasting(
      request.amount,
      analysis.least_daily_spend,
    );

    // Create ledger transactions
    const transactions = [];
    const unlockId = generateUUID();

    // Create debit from savings
    transactions.push({
      pocket_id: savingsPocket.id,
      amount: -request.amount,
      type: 'reallocation_out' as const,
      emergency_unlock_id: unlockId,
    });

    // Create credits to non-savings pockets
    for (const allocation of allocations) {
      transactions.push({
        pocket_id: allocation.pocket_id,
        amount: allocation.amount,
        type: 'reallocation_in' as const,
        emergency_unlock_id: unlockId,
      });
    }

    // Execute transactions
    await this.repository.createTransactions(transactions);

    // Record unlock event
    await this.repository.createEmergencyUnlock({
      user_id: userId,
      plan_id: planId,
      amount: request.amount,
      days_calculated: daysLasting,
      least_daily_spend: analysis.least_daily_spend,
      average_daily_spend: analysis.average_daily_spend,
      reserve_kept: savings_reserve.minimum_reserve,
    });

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
        days_lasting: daysLasting,
        reserve_kept: savings_reserve.minimum_reserve,
        allocations: allocations.map((alloc) => ({
          pocket_id: alloc.pocket_id,
          pocket_name: alloc.pocket_name,
          amount: alloc.amount,
          percentage: alloc.percentage,
        })),
      },
      next_available: nextAvailable.toISOString(),
    };
  }

  /**
   * Calculate minimum reserve to keep in savings.
   * Uses the greater of 20% or KSh 1000 minimum.
   */
  private calculateReserve(totalSavings: number): number {
    const percentageReserve = totalSavings * RESERVE_PERCENTAGE;
    return Math.max(percentageReserve, MINIMUM_RESERVE_AMOUNT);
  }

  /**
   * Calculate proportional allocation to non-savings pockets.
   * Uses monthly_allocation as the basis for proportional distribution.
   */
  private calculateProportionalAllocation(
    amount: number,
    pockets: Pocket[],
  ): Array<{
    pocket_id: string;
    pocket_name: string;
    amount: number;
    percentage: number;
  }> {
    const totalAllocation = pockets.reduce((sum, p) => sum + (p.monthly_allocation || 0), 0);

    if (totalAllocation === 0) {
      // Equal distribution if no allocations set
      const equalAmount = amount / pockets.length;
      return pockets.map((p) => ({
        pocket_id: p.id,
        pocket_name: p.name,
        amount: equalAmount,
        percentage: 100 / pockets.length,
      }));
    }

    // Proportional distribution based on monthly_allocation
    return pockets.map((p) => {
      const pocketAllocation = p.monthly_allocation || 0;
      const percentage = (pocketAllocation / totalAllocation) * 100;
      const pocketAmount = (amount * percentage) / 100;

      return {
        pocket_id: p.id,
        pocket_name: p.name,
        amount: pocketAmount,
        percentage,
      };
    });
  }
}