import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlanningCycleService } from './planning-cycle.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DailyAllocationService } from '../daily-allocation/daily-allocation.service';

@Injectable()
export class PlanningCycleCronService {
  constructor(
    private readonly planningCycleService: PlanningCycleService,
    private readonly repository: SupabaseRepository,
    private readonly dailyAllocation: DailyAllocationService,
  ) {}

  /**
   * Runs daily at 00:05 EAT (21:05 UTC) to check for plans whose
   * monthly_planning_day matches today and execute their planning cycle.
   */
  @Cron('5 21 * * *') // 00:05 EAT = 21:05 UTC (previous day)
  async runDailyPlanningCycleCheck(): Promise<void> {
    try {
      const today = new Date();
      const todayEAT = this.toEAT(today);
      const dayOfMonth = todayEAT.getDate();

      // Get all active freelancer daily plans with this monthly_planning_day
      const plans = await this.repository.getPlansByMonthlyPlanningDay(dayOfMonth);

      for (const plan of plans) {
        // Check if we already ran the cycle today
        if (plan.last_planning_cycle_at) {
          const lastCycle = new Date(plan.last_planning_cycle_at);
          const lastCycleEAT = this.toEAT(lastCycle);
          if (lastCycleEAT.toDateString() === todayEAT.toDateString()) {
            // Already ran today
            continue;
          }
        }

        try {
          await this.planningCycleService.executePlanningCycle(plan.id);
          console.log(`Planning cycle completed for plan ${plan.id}`);
        } catch (error) {
          console.error(`Planning cycle failed for plan ${plan.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Daily planning cycle check failed:', error);
    }
  }

  /**
   * Runs daily at 00:00 EAT (21:00 UTC) to create daily allocations.
   *
   * BUG FIX (2026-08-27): this used to only console.log("Would create
   * daily allocation...") instead of actually calling
   * DailyAllocationService.createDailyAllocation. That meant GET
   * /pockets/daily-allocation/today always returned null for every
   * freelancer user, forever, and the freelancer dashboard's "Today's
   * Allocation" card permanently showed its empty state ("Your daily
   * budget will appear here at midnight") — a promise the app was never
   * going to keep. Now actually creates the row. Also drops the cron's
   * own separate computeDailyBudget in favor of calling
   * DailyAllocationService.getDailyBudget directly, so there's one
   * "how do we compute today's daily budget" implementation instead of
   * two that could drift from each other the same way the loan
   * payment-count formula did (see codebase-review-2026-08-27.md).
   */
  @Cron('0 21 * * *') // 00:00 EAT = 21:00 UTC (previous day)
  async runDailyAllocationCreation(): Promise<void> {
    try {
      const today = new Date();
      const todayEAT = this.toEAT(today);
      const dateStr = todayEAT.toISOString().split('T')[0];

      // Get all active freelancer daily plans
      const plans = await this.repository.getActiveFreelancerDailyPlans();

      for (const plan of plans) {
        try {
          // Check if allocation already exists for today
          const existing = await this.repository.getDailyAllocationByPlanIdAndDate(
            plan.id,
            dateStr,
          );
          if (existing) continue;

          const dailyBudget = await this.dailyAllocation.getDailyBudget(plan.id);
          await this.dailyAllocation.createDailyAllocation(plan.user_id, plan.id, dailyBudget, todayEAT);
        } catch (error) {
          console.error(`Daily allocation creation failed for plan ${plan.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Daily allocation creation failed:', error);
    }
  }

  /**
   * Runs daily at 23:55 EAT (20:55 UTC) to close daily allocations and sweep.
   *
   * BUG FIX (2026-08-27): same as runDailyAllocationCreation above — this
   * only console.logged instead of calling
   * DailyAllocationService.closeDailyAllocation, so an allocation created
   * by the fix above would otherwise stay 'open' forever and never sweep
   * unused funds back to Reserve or record overspend.
   */
  @Cron('55 20 * * *') // 23:55 EAT = 20:55 UTC (same day)
  async runDailyAllocationClose(): Promise<void> {
    try {
      const today = new Date();
      const todayEAT = this.toEAT(today);
      const dateStr = todayEAT.toISOString().split('T')[0];

      // Get all open daily allocations for today
      const allocations = await this.repository.getOpenDailyAllocationsByDate(dateStr);

      for (const allocation of allocations) {
        try {
          // Calculate actual spend from transactions
          const actualSpend = await this.repository.getActualSpendForAllocation(
            allocation.id,
          );

          await this.dailyAllocation.closeDailyAllocation(allocation.id, actualSpend);
        } catch (error) {
          console.error(`Daily allocation close failed for ${allocation.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Daily allocation close failed:', error);
    }
  }

  private toEAT(date: Date): Date {
    // EAT is UTC+3
    const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    return eat;
  }
}