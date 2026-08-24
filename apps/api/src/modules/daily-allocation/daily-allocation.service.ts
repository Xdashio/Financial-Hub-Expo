import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import type { Plan, TransactionInsert } from '../../database/database.types';
import type { DailyAllocation } from '@financial-hub/shared';
import { sumMoney, toCents, fromCents } from '@financial-hub/shared';

const DAILY_ALLOCATION_BUFFER = 1; // minimum 1 unit to trigger allocation

const RESERVE_POOL_POCKET_ID = '_reserve_pool';

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
   */
  async createDailyAllocation(
    userId: string,
    planId: string,
    dailyBudget: number,
    today: Date,
  ): Promise<DailyAllocation> {
    // Check if an allocation already exists for today
    const dateStr = today.toISOString().split('T')[0];
    const existing = await this.repository.getDailyAllocationByPlanIdAndDate(planId, dateStr);
    if (existing) {
      return existing as DailyAllocation;
    }

    // Calculate runway days from the plan's reserve_balance
    const plan = await this.repository.getPlanById(planId);
    const reserveBalance = plan?.reserve_balance ?? 0;

    // Runway = remaining reserve after today's allocation
    const runwayDays = Math.max(1, Math.floor(reserveBalance / dailyBudget));

    const allocation: DailyAllocation = {
      id: '',
      planId: planId,
      userId: userId,
      allocationDate: dateStr,
      plannedAmount: dailyBudget,
      actualSpend: 0,
      returnedAmount: 0,
      overspendAmount: 0,
      runwayDaysAtOpen: runwayDays,
      runwayDaysAtClose: null,
      status: 'open',
      createdAt: new Date().toISOString(),
      closedAt: null,
    };

    // Reserve debit: release daily budget from Reserve
    const transactions: TransactionInsert[] = [
      {
        pocket_id: RESERVE_POOL_POCKET_ID, // Reserve is logical, tracked via reserve_balance on plans
        amount: -dailyBudget,
        type: 'reserve_release',
        merchant: 'Daily Allocation',
        category: 'personal_care',
        emergency_unlock_id: null,
        daily_allocation_id: allocation.id,
      },
    ];

    const [allocCreated] = await Promise.all([
      this.repository.createDailyAllocation({
        id: '',
        plan_id: planId,
        user_id: userId,
        allocation_date: dateStr,
        planned_amount: dailyBudget,
        actual_spend: 0,
        returned_amount: 0,
        overspend_amount: 0,
        runway_days_at_open: runwayDays,
        runway_days_at_close: null,
        status: 'open',
        created_at: new Date(),
        closed_at: null,
      }),
      this.repository.createTransactions(transactions),
    ]);

    return {
      ...allocation,
      id: allocCreated.id,
    };
  }

  /**
   * Close today's daily allocation (end-of-day sweep).
   * Moves unused funds back to Reserve, records overspend.
   */
  async closeDailyAllocation(
    allocationId: string,
    actualSpend: number,
  ): Promise<DailyAllocation> {
    const allocation = await this.repository.getDailyAllocationById(allocationId);
    if (!allocation) {
      throw new BadRequestException('Daily allocation not found');
    }
    if (allocation.status === 'closed') {
      return allocation as DailyAllocation;
    }

    const planned = allocation.planned_amount;
    const unused = planned - actualSpend;
    const overspend = actualSpend - planned;

    let newReturnedAmount = 0;
    let newOverspendAmount = 0;

    if (unused > 0) {
      // Unused funds return to Reserve
      newReturnedAmount = unused;
    }

    if (overspend > 0) {
      // Overspend directly debits Reserve
      newOverspendAmount = overspend;
    }

    // Compute runway at close
    let runwayDaysAtClose: number | null = null;
    const currentRunway = allocation.runway_days_at_open;
    
    if (unused > 0 && currentRunway) {
      // Underspend extends runway
      runwayDaysAtClose = currentRunway;
    } else if (overspend > 0 && currentRunway) {
      // Overspend compresses runway
      runwayDaysAtClose = Math.max(1, currentRunway - 1);
    }

    const closedAt = new Date();

    const updateData = {
      actual_spend: actualSpend,
      returned_amount: newReturnedAmount,
      overspend_amount: newOverspendAmount,
      status: 'closed' as const,
      closed_at: closedAt,
      runway_days_at_close: runwayDaysAtClose,
    };

    const updated = await this.repository.updateDailyAllocation(
      allocationId,
      updateData,
    );

    // Create the return/overspend transactions
    const txPromises = [];
    if (newReturnedAmount > 0) {
      txPromises.push(
        this.repository.createTransaction({
          pocket_id: RESERVE_POOL_POCKET_ID,
          amount: newReturnedAmount,
          type: 'reserve_return',
          merchant: 'Daily Allocation Sweep',
          category: 'personal_care',
          emergency_unlock_id: null,
          daily_allocation_id: allocationId,
        }),
      );
    }
    if (newOverspendAmount > 0) {
      txPromises.push(
        this.repository.createTransaction({
          pocket_id: RESERVE_POOL_POCKET_ID,
          amount: -newOverspendAmount,
          type: 'daily_overspend_debit',
          merchant: 'Daily Overspend',
          category: 'personal_care',
          emergency_unlock_id: null,
          daily_allocation_id: allocationId,
        }),
      );
    }

    await Promise.all(txPromises);

    return {
      ...allocation,
      actual_spend: actualSpend,
      returned_amount: newReturnedAmount,
      overspend_amount: newOverspendAmount,
      status: 'closed' as const,
      closed_at: closedAt,
      runway_days_at_close: runwayDaysAtClose,
      id: updated.id,
    };
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