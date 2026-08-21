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
import { resolveSubPocketSplit } from '../../common/sub-pocket-split';

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
        is_capped?: boolean;
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

    const allocations = await this.applySubPocketSplits(this.calculateAllocationsBasedOnProportions(dto.amount, pockets));

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
        is_capped?: boolean;
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

    // Income surplus detection (audit_team.md item 1).
    // Prefer plan.expected_income_amount (set at onboarding from incomeAmount).
    // If missing on older plans, fall back to the sum of top-level pocket
    // allocations and best-effort backfill the plan so surplus works next time.
    let expectedIncome = plan.expected_income_amount;
    if (expectedIncome == null || expectedIncome <= 0) {
      const derived = round2(
        pockets.reduce((sum, p) => sum + (Number(p.monthly_allocation) || 0), 0),
      );
      if (derived > 0) {
        expectedIncome = derived;
        if (typeof this.repository.updatePlan === 'function') {
          try {
            await this.repository.updatePlan(plan.id, {
              expected_income_amount: derived,
            });
          } catch (err) {
            this.logger.warn(
              `could not backfill expected_income_amount: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
      }
    }

    const hasSurplus = !!expectedIncome && expectedIncome > 0 && dto.amount > expectedIncome;
    const normalAllocationAmount = hasSurplus ? expectedIncome! : dto.amount;
    const surplusAmount = hasSurplus ? dto.amount - expectedIncome! : 0;

    // Create income event. Production DBs that predate surplus columns
    // reject inserts that mention those fields (PGRST204) — so we never
    // include them on the initial insert. Surplus is applied via a
    // best-effort update afterwards when the columns exist.
    const incomeEventBase = {
      id: uuidv4(),
      user_id: userId,
      amount: dto.amount,
      source: dto.source,
      // '' not null: older DBs still have label NOT NULL.
      label: dto.label?.trim() || '',
      date: dto.date,
      run_allocation: dto.run_allocation,
    };

    let createdIncomeEvent;
    try {
      createdIncomeEvent = await this.repository.createIncomeEvent(incomeEventBase);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err);
      this.logger.error(`createIncomeEvent failed: ${msg}`);
      throw new BadRequestException(`Could not save income event: ${msg}`);
    }
    if (!createdIncomeEvent) {
      throw new BadRequestException('Failed to create income event.');
    }

    if (hasSurplus) {
      try {
        const updated = await this.repository.updateIncomeEvent(createdIncomeEvent.id, {
          unallocated_surplus: surplusAmount,
          surplus_allocation_status: 'pending',
        });
        if (updated) {
          createdIncomeEvent = updated;
        }
      } catch (err) {
        this.logger.warn(
          `surplus columns unavailable; income saved without surplus tracking: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    let allocation = {
      triggered: false,
      allocations: [] as Array<{ pocket_id: string; pocket_name: string; amount: number; percentage: number; is_minimum?: boolean; is_capped?: boolean }>,
      total_allocated: 0,
      unallocated: dto.amount,
    };

    if (dto.run_allocation) {
      // Allocate only the normal amount (expected income), not the surplus
      const baseAllocations = this.calculateAllocationsBasedOnProportions(normalAllocationAmount, pockets);
      const allocations = await this.applySubPocketSplits(baseAllocations, dto.sub_split_overrides);

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
          is_capped: alloc.is_capped,
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
        allocation_status:
          createdIncomeEvent.surplus_allocation_status ??
          (hasSurplus ? ('pending' as const) : null),
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

  /**
   * Extends `calculateAllocationsBasedOnProportions`'s output: for any
   * top-level pocket that has sub-pockets, redirect the distributable
   * portion of its share (Σ sub-pockets' splitPercentage, capped at 100)
   * to those sub-pockets, each getting `parentShare * splitPercentage /
   * 100` of THIS event's actual amount (not the static plan ceiling — a
   * bigger/smaller-than-planned income event scales sub-pockets
   * proportionally too, same as top-level pockets already do). The
   * remainder — `parentShare * (1 - ΣsplitPercentage/100)` — stays as the
   * parent's own allocation row, becoming its reserved balance (see
   * pockets.service.ts rebalanceSubPockets and SUB_POCKET_SPLITS spec §2:
   * a parent with sub-pockets doesn't spend this directly — it's a
   * backstop the overflow-borrow flow draws from).
   *
   * Per-event overrides (Add Income preview's expandable sub-split editor)
   * are handled by the caller passing pre-computed `subSplitOverrides`
   * instead of falling through to each sub-pocket's stored percentage —
   * see allocateIncome below.
   */
  private async applySubPocketSplits(
    allocations: Array<{ pocket_id: string; pocket_name: string; amount: number; percentage: number; is_minimum?: boolean; is_capped?: boolean }>,
    subSplitOverrides?: Record<string, Array<{ pocketId: string; amount: number }>>,
  ): Promise<Array<{ pocket_id: string; pocket_name: string; amount: number; percentage: number; is_minimum?: boolean; is_capped?: boolean }>> {
    const result: typeof allocations = [];

    for (const allocation of allocations) {
      const override = subSplitOverrides?.[allocation.pocket_id];
      const subPockets = override ? null : await this.repository.getSubPocketsByParentId(allocation.pocket_id);

      if (override) {
        // Validate every override target is actually a sub-pocket of this
        // parent before trusting client-supplied amounts — otherwise a
        // malformed or malicious payload could redirect allocation money to
        // an arbitrary pocket_id, including one belonging to someone else.
        const actualSubPockets = await this.repository.getSubPocketsByParentId(allocation.pocket_id);
        const validSubPocketIds = new Set(actualSubPockets.map((s) => s.id));
        const validOverride = override.filter((o) => validSubPocketIds.has(o.pocketId));

        const overrideTotal = round2(validOverride.reduce((sum, o) => sum + o.amount, 0));
        const cappedOverrideTotal = Math.min(overrideTotal, allocation.amount);
        const scale = overrideTotal > 0 ? cappedOverrideTotal / overrideTotal : 1;
        const remainder = Math.max(0, round2(allocation.amount - cappedOverrideTotal));
        if (remainder > 0) {
          result.push({ ...allocation, amount: remainder });
        }
        for (const sub of validOverride) {
          const amount = round2(sub.amount * scale);
          if (amount > 0) {
            const subPocket = actualSubPockets.find((s) => s.id === sub.pocketId);
            result.push({
              pocket_id: sub.pocketId,
              pocket_name: subPocket?.name ?? sub.pocketId,
              amount,
              percentage: allocation.percentage,
              is_minimum: false,
              is_capped: false,
            });
          }
        }
        continue;
      }

      if (!subPockets || subPockets.length === 0) {
        result.push(allocation);
        continue;
      }

      // Delegate to the shared helper so every allocation path (income,
      // surplus, rollover) applies identical split-percentage semantics.
      // Bug fix: previously the loop used `split_percentage || 0` which
      // silently skipped sub-pockets whose percentage was legitimately set —
      // the shared helper makes the null-coalescing intent explicit and
      // centralises the rounding so callers can't diverge.
      const resolved = resolveSubPocketSplit(
        allocation.pocket_id,
        allocation.pocket_name,
        allocation.amount,
        allocation.percentage,
        subPockets,
      );

      if (resolved.length === 0) {
        // No sub-pocket has a positive split_percentage — entire amount stays
        // with the parent (all sub-pockets have pct 0 / null).
        result.push(allocation);
        continue;
      }

      for (const row of resolved) {
        result.push({
          pocket_id: row.pocket_id,
          pocket_name: row.pocket_name,
          amount: row.amount,
          percentage: allocation.percentage,
          is_minimum: row.pocket_id === allocation.pocket_id ? allocation.is_minimum : false,
          is_capped: row.pocket_id === allocation.pocket_id ? allocation.is_capped : false,
        });
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
    is_capped?: boolean;
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
      return { pocket, amount: totalAmount * proportion, is_capped: false };
    });

    // Cap fixed pockets at their monthly_allocation - they should not receive
    // more than their allocated amount regardless of income size. Any excess
    // is redistributed to spendable and savings pockets.
    const fixedRows = raw.filter(r => r.pocket.kind === 'fixed');
    let fixedExcess = 0;
    for (const row of fixedRows) {
      const maxAmount = row.pocket.monthly_allocation || 0;
      if (row.amount > maxAmount) {
        const excess = row.amount - maxAmount;
        fixedExcess += excess;
        row.amount = maxAmount;
        row.is_capped = true;
      }
    }

    // Redistribute fixed pocket excess to spendable and savings pockets
    if (fixedExcess > 0) {
      const nonFixedRows = raw.filter(r => r.pocket.kind !== 'fixed');
      const nonFixedTotal = nonFixedRows.reduce((sum, r) => sum + r.amount, 0);

      if (nonFixedTotal > 0) {
        // Scale up non-fixed pockets proportionally to absorb the excess
        const scale = (nonFixedTotal + fixedExcess) / nonFixedTotal;
        for (const row of nonFixedRows) {
          row.amount = row.amount * scale;
        }
      }
    }

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
          is_capped: row.is_capped,
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
        const allocations = await this.applySubPocketSplits(
          this.calculateAllocationsBasedOnProportions(incomeEvent.unallocated_surplus, pockets),
        );
        
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}