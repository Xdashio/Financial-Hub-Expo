import { Controller, Get, Post, Param, Request, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PlanningCycleService } from './planning-cycle.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@ApiTags('Planning Cycle')
@Controller('planning-cycle')
@ApiBearerAuth()
export class PlanningCycleController {
  constructor(
    private readonly planningCycleService: PlanningCycleService,
    private readonly repository: SupabaseRepository,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get the current planning cycle status and next run date' })
  @ApiResponse({ status: 200, description: 'Current cycle status and next planning date' })
  @ApiResponse({ status: 404, description: 'No active plan found' })
  async getStatus(@Request() req: any) {
    const plan = await this.repository.getActivePlanByUserId(req.user.id);
    if (!plan) {
      throw new Error('No active plan found');
    }

    const today = new Date();
    const nextPlanningDate = this.getNextPlanningDate(today, plan.monthly_planning_day);
    const lastCycle = plan.last_planning_cycle_at ? new Date(plan.last_planning_cycle_at) : null;

    return {
      monthly_planning_day: plan.monthly_planning_day,
      last_planning_cycle_at: plan.last_planning_cycle_at,
      next_planning_date: nextPlanningDate.toISOString().split('T')[0],
      days_until_next: Math.ceil((nextPlanningDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get planning cycle event history' })
  @ApiResponse({ status: 200, description: 'Array of planning cycle events' })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Number of months of history to fetch (default: 6)' })
  @ApiResponse({ status: 404, description: 'No active plan found' })
  async getHistory(
    @Query('months') months: string,
    @Request() req: any
  ) {
    const plan = await this.repository.getActivePlanByUserId(req.user.id);
    if (!plan) {
      throw new Error('No active plan found');
    }

    const monthsNum = months ? parseInt(months, 10) : 6;
    return this.repository.getPlanningCycleEventsByUserId(req.user.id, monthsNum);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get the current cycle\'s allocation snapshot and recommendations' })
  @ApiResponse({ status: 200, description: 'Current cycle allocation and behavioral recommendations' })
  @ApiResponse({ status: 404, description: 'No active plan found' })
  async getCurrentCycle(@Request() req: any) {
    const plan = await this.repository.getActivePlanByUserId(req.user.id);
    if (!plan) {
      throw new Error('No active plan found');
    }

    const cycleMonth = this.getCycleMonth(new Date());
    const events = await this.repository.getPlanningCycleEventsByUserId(req.user.id, 1);
    const currentEvent = events.find(e => e.cycle_month === cycleMonth);

    if (!currentEvent) {
      return {
        cycle_month: cycleMonth,
        allocations: [],
        recommendations: [],
        message: 'No planning cycle run yet for this month',
      };
    }

    return {
      cycle_month: currentEvent.cycle_month,
      reserve_balance_at_start: currentEvent.reserve_balance_at_start,
      total_fixed_obligations: currentEvent.total_fixed_obligations,
      discretionary_reserve: currentEvent.discretionary_reserve,
      daily_budget: currentEvent.daily_budget,
      runway_days: currentEvent.runway_days,
      allocations: currentEvent.allocation_snapshot || [],
      recommendations: currentEvent.recommendations_snapshot || [],
    };
  }

  @Post('trigger')
  @ApiOperation({ summary: 'Manually trigger the monthly planning cycle (testing/debugging)' })
  @ApiResponse({ status: 200, description: 'Planning cycle executed with new allocations' })
  @ApiResponse({ status: 400, description: 'Not a freelancer daily plan' })
  @ApiResponse({ status: 404, description: 'No active plan found' })
  async triggerPlanningCycle(@Request() req: any) {
    const plan = await this.repository.getActivePlanByUserId(req.user.id);
    if (!plan) {
      throw new Error('No active plan found');
    }

    if (plan.income_pattern !== 'freelancer' || plan.type !== 'daily') {
      throw new Error('Planning cycle only applies to freelancer daily plans');
    }

    return this.planningCycleService.executePlanningCycle(plan.id);
  }

  @Post('fixed-expenses/:id/apply-recommendation')
  @ApiOperation({ summary: 'Apply a behavioral recommendation to a fixed expense' })
  @ApiResponse({ status: 200, description: 'Recommendation applied, fixed expense updated' })
  @ApiResponse({ status: 404, description: 'Fixed expense not found' })
  async applyRecommendation(
    @Param('id') expenseId: string,
    @Body() body: { newAllocation: number },
    @Request() req: any
  ) {
    const expense = await this.repository.getFixedExpenseById(expenseId);
    if (!expense || expense.user_id !== req.user.id) {
      throw new Error('Fixed expense not found');
    }

    await this.repository.updateFixedExpense(expenseId, {
      amount: body.newAllocation,
    });

    return { applied: true, expenseId, newAllocation: body.newAllocation };
  }

  private getCycleMonth(date: Date): string {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }

  private getNextPlanningDate(date: Date, planningDay: number): Date {
    const d = new Date(date);
    d.setDate(planningDay);
    d.setHours(0, 0, 0, 0);

    if (date.getDate() >= planningDay) {
      d.setMonth(d.getMonth() + 1);
    }

    return d;
  }
}