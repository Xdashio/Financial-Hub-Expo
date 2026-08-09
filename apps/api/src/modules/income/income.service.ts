import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateIncomeDto, AllocatePreviewDto } from './dto';
import { SupabaseRepository } from '../../database/supabase.repository';
import { IncomeEventInsert, TransactionInsert, Pocket, Plan } from '../../database/database.types';

@Injectable()
export class IncomeService {
  constructor(private readonly repository: SupabaseRepository) {}

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
      }>;
      total_allocated: number;
      unallocated: number;
    };
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
      const transactions: TransactionInsert[] = allocations.map(alloc => ({
        pocket_id: alloc.pocket_id,
        amount: alloc.amount,
        type: 'allocation' as const,
        merchant: null,
        category: null,
      }));

      await this.repository.createTransactions(transactions);

      allocation = {
        triggered: true,
        allocations: allocations.map(alloc => ({
          pocket_id: alloc.pocket_id,
          pocket_name: alloc.pocket_name,
          amount: alloc.amount,
          percentage: alloc.percentage,
        })),
        total_allocated: allocations.reduce((sum, a) => sum + a.amount, 0),
        unallocated: dto.amount - allocations.reduce((sum, a) => sum + a.amount, 0),
      };
    }

    return {
      income_event: createdIncomeEvent,
      allocation,
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