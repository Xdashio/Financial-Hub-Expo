import { Injectable } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import type { Plan, FixedExpense } from '../../database/database.types';
import type { DailyAllocation } from '@financial-hub/shared';
import { sumMoney, round2 } from '@financial-hub/shared';
import { toCamelCaseResponse } from '../../common/case-transform';

export interface PlanningCycleInput {
  plan: Plan;
  fixedExpenses: FixedExpense[];
  incomeEvents: { amount: number; date: string }[];
  dailyAllocations: DailyAllocation[];
  today: Date;
}

export interface FixedExpenseAllocation {
  expenseId: string;
  name: string;
  amount: number;
  fundedAmount: number;
  carryForwardAmount: number;
  previousCarryForward: number;
}

export interface BehavioralRecommendation {
  expenseId: string;
  name: string;
  currentAllocation: number;
  recommendedAllocation: number;
  reason: string;
}

export interface PlanningCycleResult {
  reserveBalanceAtStart: number;
  totalFixedObligations: number;
  discretionaryReserve: number;
  dailyBudget: number;
  runwayDays: number;
  fixedExpenseAllocations: FixedExpenseAllocation[];
  recommendations: BehavioralRecommendation[];
  cycleMonth: string;
}

@Injectable()
export class PlanningCycleService {
  constructor(private readonly repository: SupabaseRepository) {}

  /**
   * Execute the Monthly Planning Cycle for a plan.
   * This is called by the cron job on the user's configured monthly_planning_day.
   */
  async executePlanningCycle(planId: string): Promise<PlanningCycleResult> {
    const plan = await this.repository.getPlanById(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    // Only run for freelancer daily plans
    if (plan.income_pattern !== 'freelancer' || plan.type !== 'daily') {
      throw new Error('Planning cycle only applies to freelancer daily plans');
    }

    const userId = plan.user_id;
    const today = new Date();
    const cycleMonth = this.getCycleMonth(today);

    // Get data for the cycle
    const fixedExpenses = await this.repository.getFixedExpensesByUserId(userId);
    const incomeEvents = await this.repository.getIncomeEventsByUserId(userId);
    const dailyAllocations = await this.repository.getDailyAllocationsByPlanIdAndMonth(
      planId,
      cycleMonth,
    );

    // Execute the planning cycle logic
    const result = await this.computePlanningCycle({
      plan,
      fixedExpenses,
      incomeEvents: incomeEvents.map(e => ({ amount: e.amount, date: e.date })),
      dailyAllocations,
      today,
    });

    // Update fixed expenses with new funded amounts
    await this.updateFixedExpensesFunding(result.fixedExpenseAllocations);

    // Update plan with new reserve balance, daily budget, and planning cycle timestamp
    await this.repository.updatePlan(planId, {
      reserve_balance: result.discretionaryReserve + result.totalFixedObligations,
      last_planning_cycle_at: today.toISOString(),
    });

    // Record the planning cycle event
    await this.repository.createPlanningCycleEvent({
      plan_id: planId,
      user_id: userId,
      cycle_month: cycleMonth,
      reserve_balance_at_start: result.reserveBalanceAtStart,
      total_fixed_obligations: result.totalFixedObligations,
      discretionary_reserve: result.discretionaryReserve,
      daily_budget: result.dailyBudget,
      runway_days: result.runwayDays,
      allocation_snapshot: result.fixedExpenseAllocations,
      recommendations_snapshot: result.recommendations,
    });

    return result;
  }

  /**
   * Compute the planning cycle allocations and recommendations.
   */
  private async computePlanningCycle(input: PlanningCycleInput): Promise<PlanningCycleResult> {
    const { plan, fixedExpenses, incomeEvents, dailyAllocations, today } = input;

    // 1. Calculate total income for the previous cycle
    const cycleStart = this.getCycleStartDate(today, plan.monthly_planning_day);
    const previousCycleStart = new Date(cycleStart);
    previousCycleStart.setMonth(previousCycleStart.getMonth() - 1);

    const cycleIncome = incomeEvents
      .filter(e => new Date(e.date) >= previousCycleStart && new Date(e.date) < cycleStart)
      .reduce((sum, e) => sum + e.amount, 0);

    // 2. Get reserve balance at start (from plan)
    const reserveBalanceAtStart = plan.reserve_balance || 0;

    // 3. Analyze previous month's actual spending vs allocations
    const spendingAnalysis = this.analyzePreviousCycleSpending(
      fixedExpenses,
      dailyAllocations,
    );

    // 4. Determine fixed expense allocations for this cycle
    const fixedExpenseAllocations = this.computeFixedExpenseAllocations(
      fixedExpenses,
      spendingAnalysis,
      reserveBalanceAtStart,
    );

    const totalFixedObligations = fixedExpenseAllocations.reduce(
      (sum, a) => sum + a.fundedAmount,
      0
    );

    // 5. Calculate discretionary reserve (reserve - fixed obligations)
    const discretionaryReserve = Math.max(0, reserveBalanceAtStart - totalFixedObligations);

    // 6. Calculate daily budget and runway
    // Daily budget is based on the user's configured daily spending target
    // or derived from discretionary reserve / target runway days
    const targetRunwayDays = 30; // Target 30-day runway
    const dailyBudget = Math.max(1, Math.round(discretionaryReserve / targetRunwayDays * 100) / 100);
    const runwayDays = dailyBudget > 0 ? Math.floor(discretionaryReserve / dailyBudget) : 3;

    // 7. Generate behavioral recommendations
    const recommendations = this.generateBehavioralRecommendations(
      fixedExpenses,
      spendingAnalysis,
      fixedExpenseAllocations,
    );

    return {
      reserveBalanceAtStart,
      totalFixedObligations,
      discretionaryReserve,
      dailyBudget,
      runwayDays,
      fixedExpenseAllocations,
      recommendations,
      cycleMonth: this.getCycleMonth(today),
    };
  }

  /**
   * Analyze previous cycle's actual spending vs budgeted amounts.
   */
  private analyzePreviousCycleSpending(
    fixedExpenses: FixedExpense[],
    dailyAllocations: DailyAllocation[],
  ): {
    fixedExpenseSpending: Map<string, number>;
    dailySpending: { total: number; days: number; average: number };
  } {
    const fixedExpenseSpending = new Map<string, number>();
    
    // Sum actual spending per fixed expense from daily allocations
    // This would need transaction-level data; simplified here
    for (const expense of fixedExpenses) {
      fixedExpenseSpending.set(expense.id, 0);
    }

    // Analyze daily allocations
    let totalDailySpend = 0;
    let dayCount = 0;
    for (const alloc of dailyAllocations) {
      if (alloc.status === 'closed') {
        totalDailySpend += alloc.actualSpend;
        dayCount++;
      }
    }

    return {
      fixedExpenseSpending,
      dailySpending: {
        total: totalDailySpend,
        days: dayCount,
        average: dayCount > 0 ? totalDailySpend / dayCount : 0,
      },
    };
  }

  /**
   * Compute fixed expense allocations for the new cycle.
   * Handles carry-forward logic per expense.
   */
  private computeFixedExpenseAllocations(
    fixedExpenses: FixedExpense[],
    spendingAnalysis: {
      fixedExpenseSpending: Map<string, number>;
      dailySpending: { total: number; days: number; average: number };
    },
    reserveBalance: number,
  ): FixedExpenseAllocation[] {
    const allocations: FixedExpenseAllocation[] = [];

    for (const expense of fixedExpenses) {
      if (expense.status !== 'active') {
        allocations.push({
          expenseId: expense.id,
          name: expense.name,
          amount: expense.amount,
          fundedAmount: 0,
          carryForwardAmount: 0,
          previousCarryForward: 0,
        });
        continue;
      }

      const actualSpend = spendingAnalysis.fixedExpenseSpending.get(expense.id) || 0;
      const previousFunded = expense.funded_amount || 0;
      const surplus = previousFunded - actualSpend;

      let carryForwardAmount = 0;
      let fundedAmount = expense.amount;

      if (surplus > 0 && expense.carry_forward) {
        // Carry forward surplus to next month
        carryForwardAmount = surplus;
        fundedAmount = expense.amount - surplus;
      } else if (surplus > 0 && !expense.carry_forward) {
        // Surplus returns to Reserve (handled by reducing funded amount)
        fundedAmount = expense.amount;
      } else if (surplus < 0) {
        // Underfunded - need to allocate more
        fundedAmount = expense.amount + Math.abs(surplus);
      }

      // Ensure funded amount doesn't exceed available reserve
      // (This is a simplification; in reality we'd check against available reserve)
      fundedAmount = Math.max(0, fundedAmount);

      allocations.push({
        expenseId: expense.id,
        name: expense.name,
        amount: expense.amount,
        fundedAmount,
        carryForwardAmount,
        previousCarryForward: surplus > 0 ? surplus : 0,
      });
    }

    return allocations;
  }

  /**
   * Generate behavioral recommendations based on historical spending.
   */
  private generateBehavioralRecommendations(
    fixedExpenses: FixedExpense[],
    spendingAnalysis: {
      fixedExpenseSpending: Map<string, number>;
      dailySpending: { total: number; days: number; average: number };
    },
    allocations: FixedExpenseAllocation[],
  ): BehavioralRecommendation[] {
    const recommendations: BehavioralRecommendation[] = [];

    for (const expense of fixedExpenses) {
      if (expense.status !== 'active') continue;

      // Get historical average for this expense
      // In a real implementation, we'd query planning_cycle_events for history
      const actualSpend = spendingAnalysis.fixedExpenseSpending.get(expense.id) || 0;
      const currentAllocation = expense.amount;

      // Simple heuristic: if actual spend consistently differs from allocation,
      // recommend adjusting
      const allocation = allocations.find(a => a.expenseId === expense.id);
      if (!allocation) continue;

      const recommendedAllocation = this.calculateRecommendedAllocation(
        expense,
        actualSpend,
        currentAllocation,
      );

      if (recommendedAllocation !== currentAllocation) {
        const difference = recommendedAllocation - currentAllocation;
        let reason = '';
        
        if (difference > 0) {
          reason = `Your ${expense.name.toLowerCase()} spending has averaged KSh ${actualSpend.toFixed(0)}. Recommended allocation: KSh ${recommendedAllocation.toFixed(0)}.`;
        } else {
          reason = `Your ${expense.name.toLowerCase()} spending has averaged KSh ${actualSpend.toFixed(0)}, below your KSh ${currentAllocation.toFixed(0)} allocation. Recommended: KSh ${recommendedAllocation.toFixed(0)}.`;
        }

        recommendations.push({
          expenseId: expense.id,
          name: expense.name,
          currentAllocation,
          recommendedAllocation,
          reason,
        });
      }
    }

    return recommendations;
  }

  /**
   * Calculate recommended allocation based on spending history.
   * Uses a simple moving average with a small buffer.
   */
  private calculateRecommendedAllocation(
    expense: FixedExpense,
    actualSpend: number,
    currentAllocation: number,
  ): number {
    // If we have actual spend data, use it with a 10% buffer
    if (actualSpend > 0) {
      return round2(actualSpend * 1.1);
    }
    // Otherwise keep current allocation
    return currentAllocation;
  }

  /**
   * Update fixed expenses with new funded amounts.
   */
  private async updateFixedExpensesFunding(
    allocations: FixedExpenseAllocation[],
  ): Promise<void> {
    for (const alloc of allocations) {
      await this.repository.updateFixedExpense(alloc.expenseId, {
        funded_amount: alloc.fundedAmount,
        funded_at: new Date().toISOString(),
      });
    }
  }

  /**
   * Get the cycle month (first day of the cycle month).
   */
  private getCycleMonth(date: Date): string {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }

  /**
   * Get the start date of the current cycle based on the planning day.
   */
  private getCycleStartDate(date: Date, planningDay: number): Date {
    const d = new Date(date);
    d.setDate(planningDay);
    d.setHours(0, 0, 0, 0);
    
    // If today is before the planning day, the cycle started last month
    if (date.getDate() < planningDay) {
      d.setMonth(d.getMonth() - 1);
    }
    
    return d;
  }
}