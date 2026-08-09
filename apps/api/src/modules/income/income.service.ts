import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateIncomeDto, AllocatePreviewDto } from './dto';
import { SupabaseRepository } from '../../database/supabase.repository';
import { IncomeEventInsert, TransactionInsert, Pocket, Plan } from '../../database/database.types';
import { RunwaySummary } from '@financial-hub/shared';
import { RunwayService } from '../runway/runway.service';
import { computeSpendableDailyCaps } from '../runway/runway.calculator';

@Injectable()
export class IncomeService {
  constructor(
    private readonly repository: SupabaseRepository,
    private readonly runway: RunwayService,
  ) {}

  async allocatePreview(dto: AllocatePreviewDto, userId: string): Promise<{
    preview: {
      total_amount: number;
      allocation_rules: {
        savings_min_percentage: number;
        use_plan_rules: boolean;
      };
      projected_allocations: Array<{
        pocket_id: string;
        pocket_name: string;
        amount: number;
        percentage: number;
        is_minimum?: boolean;
      }>;
      total_allocated: number;
      unallocated: number;
      unallocated_handling: string;
    };
  }> {
    const plan: Plan | null = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      throw new BadRequestException('No active plan found. Please complete onboarding first.');
    }

    const pockets = await this.repository.getPocketsByPlanId(plan.id);
    if (pockets.length === 0) {
      throw new BadRequestException('No pockets found in your plan.');
    }

    const allocations = this.calculateAllocationsBasedOnProportions(dto.amount, pockets);

    return {
      preview: {
        total_amount: dto.amount,
        allocation_rules: {
          savings_min_percentage: 10,
          use_plan_rules: true,
        },
        projected_allocations: allocations,
        total_allocated: allocations.reduce((sum, a) => sum + a.amount, 0),
        unallocated: dto.amount - allocations.reduce((sum, a) => sum + a.amount, 0),
        unallocated_handling: 'remaining_balance',
      },
    };
  }

  async createManualIncome(dto: CreateIncomeDto, userId: string): Promise<{
    income_event: IncomeEventInsert;
    allocation: {
      triggered: boolean;
      allocations: Array<{
        pocket_id: string;
        pocket_name: string;
        amount: number;
        percentage: number;
        is_minimum?: boolean;
      }>;
      total_allocated: number;
      unallocated: number;
    };
    // Recomputed against the just-created income event — freelancer +
    // daily plans get their runway (and therefore daily_cap) refreshed on
    // every new income event, not just lazily on the next /pockets read.
    // { applicable: false } for salaried/mix/structured plans. See
    // docs/FREELANCER_RUNWAY.md.
    runway: RunwaySummary;
  }> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      throw new BadRequestException('No active plan found. Please complete onboarding first.');
    }

    const pockets = await this.repository.getPocketsByPlanId(plan.id);
    if (pockets.length === 0) {
      throw new BadRequestException('No pockets found in your plan.');
    }

    // Create income event
    const incomeEvent: IncomeEventInsert = {
      id: uuidv4(),
      user_id: userId,
      amount: dto.amount,
      source: dto.source,
      label: dto.label || null,
      date: dto.date,
      run_allocation: dto.run_allocation,
    };

    const createdIncomeEvent = await this.repository.createIncomeEvent(incomeEvent);
    if (!createdIncomeEvent) {
      throw new BadRequestException('Failed to create income event.');
    }

    let allocation = {
      triggered: false,
      allocations: [] as Array<{ pocket_id: string; pocket_name: string; amount: number; percentage: number }>,
      total_allocated: 0,
      unallocated: dto.amount,
    };

    if (dto.run_allocation) {
      const allocations = this.calculateAllocationsBasedOnProportions(dto.amount, pockets);

      // Write allocation transactions to the ledger. Balance everywhere in
      // the app is now ledger-derived (allocation credits - spend debits -
      // reallocation outflows), so writing these rows is the only step
      // needed to make the funds appear in each pocket. monthly_allocation
      // is the planning ceiling set at onboarding and is never mutated.
      //
      // Guard against calling insert() with an empty array: this happens
      // whenever every pocket's monthly_allocation is 0 (proportional split
      // has nothing to divide by), and PostgREST/supabase-js reject a
      // zero-row insert payload, which surfaced to the client as an opaque
      // 500 on POST /income/manual instead of the income event still being
      // recorded.
      if (allocations.length > 0) {
        const transactions: TransactionInsert[] = allocations.map(alloc => ({
          pocket_id: alloc.pocket_id,
          amount: alloc.amount,
          type: 'allocation' as const,
          merchant: null,
          category: null,
        }));

        await this.repository.createTransactions(transactions);
      }

      allocation = {
        triggered: true,
        allocations: allocations.map(alloc => ({
          pocket_id: alloc.pocket_id,
          pocket_name: alloc.pocket_name,
          amount: alloc.amount,
          percentage: alloc.percentage,
          is_minimum: alloc.is_minimum,
        })),
        total_allocated: allocations.reduce((sum, a) => sum + a.amount, 0),
        unallocated: dto.amount - allocations.reduce((sum, a) => sum + a.amount, 0),
      };
    }

    // Recompute runway now that this income event exists, and — for
    // freelancer + daily plans — persist the refreshed daily_cap onto each
    // spendable pocket immediately rather than waiting for the next
    // /pockets read. Deliberately happens regardless of run_allocation:
    // the event's date shifts the runway/cadence estimate either way. See
    // docs/FREELANCER_RUNWAY.md.
    let runway: RunwaySummary = { applicable: false };
    if (plan.income_pattern === 'freelancer' && plan.type === 'daily') {
      runway = await this.runway.getRunwayForPlan(userId, plan);
      const caps = computeSpendableDailyCaps(pockets, runway);
      if (caps.size > 0) {
        await Promise.all(
          Array.from(caps.entries()).map(([pocketId, dailyCap]) =>
            this.repository.updatePocket(pocketId, { daily_cap: dailyCap })
          )
        );
      }
    }

    return {
      income_event: createdIncomeEvent,
      allocation,
      runway,
    };
  }

  private calculateAllocationsBasedOnProportions(
    totalAmount: number,
    pockets: Pocket[]
  ): Array<{
    pocket_id: string;
    pocket_name: string;
    amount: number;
    percentage: number;
    is_minimum?: boolean;
  }> {
    const allocations = [];
    const totalMonthlyAllocation = pockets.reduce((sum, p) => sum + (p.monthly_allocation || 0), 0);

    if (totalMonthlyAllocation === 0) {
      return [];
    }

    // Allocate based on existing pocket proportions
    for (const pocket of pockets) {
      const pocketAllocation = pocket.monthly_allocation || 0;
      const proportion = pocketAllocation / totalMonthlyAllocation;
      const amount = totalAmount * proportion;
      const percentage = proportion * 100;

      if (amount > 0) {
        allocations.push({
          pocket_id: pocket.id,
          pocket_name: pocket.name,
          amount: Math.round(amount * 100) / 100,
          percentage: Math.round(percentage * 100) / 100,
          is_minimum: pocket.kind === 'savings',
        });
      }
    }

    return allocations;
  }
}