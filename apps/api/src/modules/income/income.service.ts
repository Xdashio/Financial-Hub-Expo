import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateIncomeDto, AllocatePreviewDto, AllocateSurplusDto } from './dto';
import { SupabaseRepository } from '../../database/supabase.repository';
import { IncomeEventInsert, TransactionInsert, Pocket, Plan, PocketInsert } from '../../database/database.types';
import { RunwaySummary } from '@financial-hub/shared';
import { RunwayService } from '../runway/runway.service';
import { computeSpendableDailyCaps } from '../runway/runway.calculator';
import { MIN_SAVINGS_RATE } from '../onboarding/rules-engine';
import { PushDeliveryService } from '../notifications/push-delivery.service';

@Injectable()
export class IncomeService {
  private readonly logger = new Logger(IncomeService.name);

  constructor(
    private readonly repository: SupabaseRepository,
    private readonly runway: RunwayService,
    private readonly pushDelivery: PushDeliveryService,
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

    const pockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
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
    surplus: {
      has_surplus: boolean;
      surplus_amount: number;
      allocation_status: 'pending' | 'allocated' | 'skipped' | null;
    };
    // Recomputed against the just-created income event — freelancer +
    // daily plans get their runway (and therefore daily_cap) refreshed on
    // every new income event, not just lazily on the next /pockets read.
    // { applicable: false } for salaried/mix/structured plans. See
    // docs/FREELANCER_RUNWAY.md.
    runway: RunwaySummary;
    idempotent_replay?: boolean;
  }> {
    if (dto.idempotency_key) {
      try {
        const existing = await this.repository.getIdempotencyRecord(
          userId,
          'income',
          dto.idempotency_key,
        );
        if (existing?.response) {
          return {
            ...(existing.response as any),
            idempotent_replay: true,
          };
        }
      } catch (err) {
        // Missing idempotency_records (migration not applied) must not 500
        // a real income deposit — log and proceed as a first write.
        this.logger.warn(
          `idempotency lookup failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      throw new BadRequestException('No active plan found. Please complete onboarding first.');
    }

    const pockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
    if (pockets.length === 0) {
      throw new BadRequestException('No pockets found in your plan.');
    }

    // Income surplus detection (audit_team.md item 1)
    // Compare entered amount against expected_income_amount
    // If no expectation is set, allocate the full amount normally (no surplus)
    const hasSurplus = plan.expected_income_amount && dto.amount > plan.expected_income_amount;
    const normalAllocationAmount = hasSurplus ? plan.expected_income_amount! : dto.amount;
    const surplusAmount = hasSurplus ? dto.amount - plan.expected_income_amount! : 0;

    // Create income event with surplus tracking.
    // Use '' instead of null for label: older production DBs still have
    // `label NOT NULL` (migration ALTER may not have been applied), which
    // turned every unlabeled POST /income/manual into an opaque 500.
    const incomeEvent: IncomeEventInsert = {
      id: uuidv4(),
      user_id: userId,
      amount: dto.amount,
      source: dto.source,
      label: dto.label?.trim() || '',
      date: dto.date,
      run_allocation: dto.run_allocation,
      unallocated_surplus: hasSurplus ? surplusAmount : null,
      surplus_allocation_status: hasSurplus ? 'pending' : null,
    };

    let createdIncomeEvent;
    try {
      createdIncomeEvent = await this.repository.createIncomeEvent(incomeEvent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Surplus columns may be missing on older DBs — retry without them
      // so a basic income deposit still succeeds.
      if (/unallocated_surplus|surplus_allocation_status/i.test(msg)) {
        this.logger.warn(`income surplus columns missing; retrying without them: ${msg}`);
        const { unallocated_surplus: _u, surplus_allocation_status: _s, ...base } = incomeEvent;
        try {
          createdIncomeEvent = await this.repository.createIncomeEvent(base as IncomeEventInsert);
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          this.logger.error(`createIncomeEvent retry failed: ${retryMsg}`);
          throw new BadRequestException(`Could not save income event: ${retryMsg}`);
        }
      } else {
        this.logger.error(`createIncomeEvent failed: ${msg}`);
        throw new BadRequestException(
          msg.includes('label')
            ? 'Could not save income (label column). Re-run income_events migrations.'
            : `Could not save income event: ${msg}`,
        );
      }
    }
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
      // Allocate only the normal amount (expected income), not the surplus
      const allocations = this.calculateAllocationsBasedOnProportions(normalAllocationAmount, pockets);

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

        try {
          await this.repository.createTransactions(transactions);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`createTransactions failed after income ${createdIncomeEvent.id}: ${msg}`);
          throw new BadRequestException(`Income saved but allocation ledger failed: ${msg}`);
        }
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

      if (allocation.total_allocated > 0) {
        // Fire-and-forget: awaiting Expo here hung POST /income/manual until
        // the Railway proxy reset the connection whenever push was slow.
        void this.pushDelivery
          .notifyAllocationReceived(
            userId,
            createdIncomeEvent.id,
            allocation.total_allocated,
            allocation.allocations.length,
          )
          .catch((err) => {
            this.logger.warn(
              `allocation push failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      }
    }

    // Recompute runway now that this income event exists, and — for
    // freelancer + daily plans — persist the refreshed daily_cap onto each
    // spendable pocket immediately rather than waiting for the next
    // /pockets read. Deliberately happens regardless of run_allocation:
    // the event's date shifts the runway/cadence estimate either way. See
    // docs/FREELANCER_RUNWAY.md.
    let runway: RunwaySummary = { applicable: false };
    if (plan.income_pattern === 'freelancer' && plan.type === 'daily') {
      try {
        runway = await this.runway.getRunwayForPlan(userId, plan);
        const caps = computeSpendableDailyCaps(pockets, runway);
        if (caps.size > 0) {
          await Promise.all(
            Array.from(caps.entries()).map(([pocketId, dailyCap]) =>
              this.repository.updatePocket(pocketId, { daily_cap: dailyCap })
            )
          );
        }
      } catch (err) {
        this.logger.warn(
          `runway refresh after income failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        runway = { applicable: false };
      }
    }

    const result = {
      income_event: createdIncomeEvent,
      allocation,
      surplus: {
        has_surplus: Boolean(hasSurplus),
        surplus_amount: surplusAmount,
        allocation_status: createdIncomeEvent.surplus_allocation_status,
      },
      runway,
    };

    if (dto.idempotency_key) {
      try {
        const saved = await this.repository.saveIdempotencyRecord({
          id: uuidv4(),
          user_id: userId,
          scope: 'income',
          idempotency_key: dto.idempotency_key,
          resource_id: createdIncomeEvent.id,
          response: result as unknown as Record<string, unknown>,
        });
        if (!saved) {
          const raced = await this.repository.getIdempotencyRecord(
            userId,
            'income',
            dto.idempotency_key,
          );
          if (raced?.response) {
            return { ...(raced.response as any), idempotent_replay: true };
          }
        }
      } catch (err) {
        this.logger.warn(
          `idempotency save failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return result;
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

    // Round each pocket's share independently first...
    const roundedRows = raw.map(row => ({
      row,
      amount: Math.round(row.amount * 100) / 100,
    }));

    // ...then reconcile: rounding every pocket to the nearest cent on its
    // own means the sum of the rounded amounts can drift a cent or two
    // away from totalAmount (e.g. an income of 500 split three ways as
    // 166.67 + 166.67 + 166.67 = 500.01, or three-way splits that land a
    // cent short). Left unreconciled, that drift is money the user logged
    // but which never lands in any pocket — it just vanishes from the
    // ledger's perspective. Apply the leftover cents to the single
    // largest allocation so the pockets always sum to exactly what was
    // deposited, and the discrepancy is invisible (a fraction of a
    // shilling on the biggest pocket) rather than an unexplained gap.
    const roundedTotal = roundedRows.reduce((sum, r) => sum + r.amount, 0);
    const remainder = Math.round((totalAmount - roundedTotal) * 100) / 100;
    if (remainder !== 0 && roundedRows.length > 0) {
      const largest = roundedRows.reduce((max, r) => (r.amount > max.amount ? r : max), roundedRows[0]);
      largest.amount = Math.round((largest.amount + remainder) * 100) / 100;
    }

    const allocations = [];
    for (const { row, amount } of roundedRows) {
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

  async allocateSurplus(
    incomeEventId: string,
    dto: AllocateSurplusDto,
    userId: string
  ): Promise<{
    success: boolean;
    allocation: {
      pocket_id: string;
      pocket_name: string;
      amount: number;
    } | null;
  }> {
    // Verify ownership of the income event
    const incomeEvent = await this.repository.getIncomeEventById(incomeEventId);
    if (!incomeEvent) {
      throw new NotFoundException('Income event not found');
    }
    if (incomeEvent.user_id !== userId) {
      throw new BadRequestException('You do not have permission to allocate this surplus');
    }
    if (!incomeEvent.unallocated_surplus || incomeEvent.surplus_allocation_status !== 'pending') {
      throw new BadRequestException('This income event has no pending surplus to allocate');
    }

    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      throw new BadRequestException('No active plan found');
    }

    switch (dto.target) {
      case 'main_pocket':
        // Allocate proportionally to all pockets using the same logic as normal income
        const pockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
        const allocations = this.calculateAllocationsBasedOnProportions(incomeEvent.unallocated_surplus, pockets);
        
        if (allocations.length === 0) {
          throw new BadRequestException('No pockets available for allocation');
        }

        // Write allocation transactions
        const transactions: TransactionInsert[] = allocations.map(alloc => ({
          pocket_id: alloc.pocket_id,
          amount: alloc.amount,
          type: 'allocation' as const,
          merchant: null,
          category: null,
        }));

        await this.repository.createTransactions(transactions);

        // Update income event status
        await this.repository.updateIncomeEvent(incomeEventId, {
          surplus_allocation_status: 'allocated',
          unallocated_surplus: null,
        });

        return {
          success: true,
          allocation: {
            pocket_id: 'main_pocket',
            pocket_name: 'Distributed across all pockets',
            amount: incomeEvent.unallocated_surplus,
          },
        };

      case 'pocket':
        if (!dto.pocket_id) {
          throw new BadRequestException('pocket_id is required when target is "pocket"');
        }

        // Verify pocket belongs to user's plan
        const pocket = await this.repository.getPocketById(dto.pocket_id);
        if (!pocket || pocket.plan_id !== plan.id) {
          throw new BadRequestException('Invalid pocket');
        }

        // Write allocation transaction
        await this.repository.createTransactions([{
          pocket_id: dto.pocket_id,
          amount: incomeEvent.unallocated_surplus,
          type: 'allocation' as const,
          merchant: null,
          category: null,
        }]);

        // Update income event status
        await this.repository.updateIncomeEvent(incomeEventId, {
          surplus_allocation_status: 'allocated',
          unallocated_surplus: null,
        });

        return {
          success: true,
          allocation: {
            pocket_id: dto.pocket_id,
            pocket_name: pocket.name,
            amount: incomeEvent.unallocated_surplus,
          },
        };

      case 'new_pocket':
        if (!dto.new_pocket_name) {
          throw new BadRequestException('new_pocket_name is required when target is "new_pocket"');
        }

        // Create new pocket (default to spendable kind, can be extended later)
        const newPocket: PocketInsert = {
          plan_id: plan.id,
          name: dto.new_pocket_name,
          kind: 'spendable',
          category: 'other',
          is_time_locked: false,
          monthly_allocation: 0,
        };

        const createdPocket = await this.repository.createPocket(newPocket);
        if (!createdPocket) {
          throw new BadRequestException('Failed to create new pocket');
        }

        // Write allocation transaction
        await this.repository.createTransactions([{
          pocket_id: createdPocket.id,
          amount: incomeEvent.unallocated_surplus,
          type: 'allocation' as const,
          merchant: null,
          category: null,
        }]);

        // Update income event status
        await this.repository.updateIncomeEvent(incomeEventId, {
          surplus_allocation_status: 'allocated',
          unallocated_surplus: null,
        });

        return {
          success: true,
          allocation: {
            pocket_id: createdPocket.id,
            pocket_name: createdPocket.name,
            amount: incomeEvent.unallocated_surplus,
          },
        };

      default:
        throw new BadRequestException('Invalid target type');
    }
  }
}