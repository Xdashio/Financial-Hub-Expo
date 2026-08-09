import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateIncomeDto, AllocatePreviewDto } from './dto';
import { SupabaseRepository } from '../../database/supabase.repository';
import { IncomeEventInsert, TransactionInsert, Pocket, Plan } from '../../database/database.types';
import { RunwaySummary } from '@financial-hub/shared';
import { RunwayService } from '../runway/runway.service';
import { computeSpendableDailyCaps } from '../runway/runway.calculator';
import { MIN_SAVINGS_RATE } from '../onboarding/rules-engine';

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
    const totalMonthlyAllocation = pockets.reduce((sum, p) => sum + (p.monthly_allocation || 0), 0);

    if (totalMonthlyAllocation === 0) {
      return [];
    }

    // First pass: split this income proportionally to each pocket's share
    // of the overall plan, same as before.
    const raw = pockets.map(pocket => {
      const pocketAllocation = pocket.monthly_allocation || 0;
      const proportion = pocketAllocation / totalMonthlyAllocation;
      return { pocket, amount: totalAmount * proportion };
    });

    // Enforce the plan's minimum savings rate (see rules-engine.ts,
    // MIN_SAVINGS_RATE) on every income event, not just at plan creation.
    // Previously, a savings pocket only got whatever proportional share it
    // happened to hold of the total plan — which is very often well under
    // 10% once fixed expenses are large relative to income — while the
    // result was still labelled `is_minimum: true`, implying a floor that
    // was never actually enforced. If a savings pocket's proportional cut
    // of *this* income event falls short of 10%, top it up to the floor
    // and pull the shortfall proportionally from the non-savings pockets
    // (scaled down, never below zero) so the total allocated still equals
    // totalAmount.
    const minSavingsTotal = totalAmount * MIN_SAVINGS_RATE;
    const savingsRows = raw.filter(r => r.pocket.kind === 'savings');
    const currentSavingsTotal = savingsRows.reduce((sum, r) => sum + r.amount, 0);

    if (savingsRows.length > 0 && currentSavingsTotal < minSavingsTotal) {
      const shortfall = minSavingsTotal - currentSavingsTotal;
      const nonSavingsRows = raw.filter(r => r.pocket.kind !== 'savings');
      const nonSavingsTotal = nonSavingsRows.reduce((sum, r) => sum + r.amount, 0);

      if (nonSavingsTotal > 0) {
        // Scale every non-savings pocket down proportionally to fund the
        // shortfall, so nothing goes negative and the sum stays exact.
        const scale = Math.max(0, (nonSavingsTotal - shortfall) / nonSavingsTotal);
        for (const row of nonSavingsRows) {
          row.amount = row.amount * scale;
        }
      }
      // Push each savings pocket up to its share of the floor. With a
      // single savings pocket (the common case) it simply becomes
      // minSavingsTotal; with more than one, distribute proportionally to
      // their existing shares of the savings total (or evenly if the
      // current total was zero).
      for (const row of savingsRows) {
        const share = currentSavingsTotal > 0 ? row.amount / currentSavingsTotal : 1 / savingsRows.length;
        row.amount = minSavingsTotal * share;
      }
    }

    const allocations = [];
    for (const row of raw) {
      const amount = Math.round(row.amount * 100) / 100;
      if (amount > 0) {
        allocations.push({
          pocket_id: row.pocket.id,
          pocket_name: row.pocket.name,
          amount,
          percentage: Math.round((amount / totalAmount) * 100 * 100) / 100,
          is_minimum: row.pocket.kind === 'savings',
        });
      }
    }

    return allocations;
  }
}