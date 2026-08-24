import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlanningCycleService } from './planning-cycle.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Injectable()
export class PlanningCycleCronService {
  constructor(
    private readonly planningCycleService: PlanningCycleService,
    private readonly repository: SupabaseRepository,
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

          // Get daily budget from plan or compute
          const dailyBudget = this.computeDailyBudget(plan);
          
          // Create the daily allocation (this would call DailyAllocationService)
          // For now, we just log
          console.log(`Would create daily allocation for plan ${plan.id}: ${dailyBudget}`);
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

          // Close the allocation (would call DailyAllocationService.closeDailyAllocation)
          console.log(`Would close allocation ${allocation.id} with spend ${actualSpend}`);
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

  private computeDailyBudget(plan: any): number {
    const reserveBalance = plan.reserve_balance || 0;
    const targetRunwayDays = 30;
    return Math.max(1, Math.round(reserveBalance / targetRunwayDays * 100) / 100);
  }
}