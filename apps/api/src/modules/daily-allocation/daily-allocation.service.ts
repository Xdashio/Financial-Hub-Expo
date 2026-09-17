import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import type { DailyAllocation } from '@financial-hub/shared';
import { toCents, fromCents } from '@financial-hub/shared';
import { assertMoneyAmount } from '../../common/money-limits';

function round2(n: number): number {
  return fromCents(toCents(n));
}

@Injectable()
export class DailyAllocationService {
  constructor(private readonly repository: SupabaseRepository) {}

  /**
   * Create today's daily allocation for a plan.
   * Called by the midnight cron (00:00 EAT).
   * Releases from Reserve the daily budget amount for variable spending.
   * The open row is created exactly once by atomic_create_daily_allocation
   * (migration 037), which locks the plan row and returns the existing
   * same-day row on a retry — concurrent cron runs cannot open the day twice.
   */
  async createDailyAllocation(
    userId: string,
    planId: string,
    dailyBudget: number,
    today: Date,
  ): Promise<DailyAllocation> {
    const dateStr = today.toISOString().split('T')[0];

    const created = await this.repository.createDailyAllocationAtomic({
      planId,
      userId,
      allocationDate: dateStr,
      plannedAmount: dailyBudget,
    });
    if (!created) {
      throw new NotFoundException('Plan not found');
    }

    return created as unknown as DailyAllocation;
  }

  /**
   * Close today's daily allocation (end-of-day sweep).
   * Moves unused funds back to Reserve, records overspend.
   * The close is exactly-once and idempotent via
   * atomic_close_daily_allocation (migration 037).
   */
  async closeDailyAllocation(
    allocationId: string,
    actualSpend: number,
  ): Promise<DailyAllocation> {
    // M1: second line of defence behind PocketsService.closeDailyAllocation.
    assertMoneyAmount(actualSpend, 'actualSpend');
    const closed = await this.repository.closeDailyAllocationAtomic(allocationId, actualSpend);
    if (!closed) {
      throw new BadRequestException('Daily allocation not found');
    }

    return closed as unknown as DailyAllocation;
  }

  /**
   * Get today's active allocation for a plan, or null if none exists.
   */
  async getTodayAllocation(planId: string, todayStr?: string): Promise<DailyAllocation | null> {
    const date = todayStr || new Date().toISOString().split('T')[0];
    return this.repository.getDailyAllocationByPlanIdAndDate(planId, date);
  }

  /**
   * Get the daily budget for a plan based on reserve and runway.
   */
  async getDailyBudget(planId: string): Promise<number> {
    const plan = await this.repository.getPlanById(planId);
    const reserveBalance = plan?.reserve_balance ?? 0;

    // Simple heuristic: divide reserve by estimated runway days
    // The actual daily budget is set during the Monthly Planning Cycle
    const estimatedRunwayDays = 30; // default
    if (reserveBalance > 0 && estimatedRunwayDays > 0) {
      return round2(reserveBalance / estimatedRunwayDays);
    }
    return 1000; // default daily budget
  }
}