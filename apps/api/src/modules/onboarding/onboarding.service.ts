import { Injectable, BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  OnboardingInputSchema,
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
  PlanRetakeResult,
  RetakeEligibility,
  PocketKind,
  PlanType,
} from '@financial-hub/shared';
import { assignPlan, validateOnboardingInput } from './rules-engine';
import { SupabaseRepository } from '../../database/supabase.repository';
import {
  nextRetakeAvailableOn,
  planBalanceRedistribution,
  sameUtcMonth,
  type RedistributionSource,
  type RedistributionTarget,
} from './plan-redistribution';
import { buildPocketInputs } from './pocket-provisioning';

@Injectable()
export class OnboardingService {
  constructor(private readonly supabaseRepo: SupabaseRepository) {}

  assign(rawInput: unknown): OnboardingAssignResult {
    const input = this.parseInput(rawInput);

    const assignment = assignPlan(input);

    return {
      plan: assignment.plan,
      planType: assignment.planType,
      incomePattern: assignment.incomePattern,
      reasons: assignment.reasons,
      remainingAfterFixed: assignment.remainingAfterFixed,
      savingsTarget: assignment.savingsTarget,
      spendableAmount: assignment.spendableAmount,
      needsRatio: assignment.needsRatio,
      needsBand: assignment.needsBand,
    };
  }

  async commit(rawInput: unknown, userId: string): Promise<OnboardingCommitResult> {
    const input = this.parseInput(rawInput);
    const assignment = assignPlan(input);
    const planId = uuidv4();

    // Deactivate any existing active plans for this user
    await this.supabaseRepo.deactivateUserPlans(userId);

    // Map income pattern: 'mix' -> 'salaried' for database
    const dbIncomePattern = assignment.incomePattern === 'mix' ? 'salaried' : assignment.incomePattern;

    // Create the new plan
    const plan = await this.supabaseRepo.createPlan({
      id: planId,
      user_id: userId,
      type: assignment.planType,
      income_pattern: dbIncomePattern,
      income_interval_days: assignment.incomeIntervalDays ?? null,
      status: 'active',
    });

    if (!plan) {
      throw new Error('Failed to create plan');
    }

    // Create pockets from persona-shaped / itemized-fixed provisioner.
    // monthly_allocation is a planning ceiling only — no allocation
    // transactions are written here: real money only enters the ledger when
    // the user logs an income event.
    const pocketInputs = buildPocketInputs(planId, assignment, input);
    const createdPockets = await this.supabaseRepo.createPockets(pocketInputs);

    // Full-replace semantics apply only when fixedExpenses is actually part
    // of this submission (including an explicit empty array, to let a
    // retake clear everything). If the field is omitted entirely, this is
    // a partial update that never touched fixed expenses, so leave
    // whatever the user already has untouched — otherwise every onboarding
    // commit that doesn't resubmit fixed expenses silently wipes them.
    if (input.fixedExpenses !== undefined) {
      // Delete existing fixed expenses to prevent duplicates when retaking check-in
      await this.supabaseRepo.deleteFixedExpensesByUserId(userId);

      for (const expense of input.fixedExpenses) {
        await this.supabaseRepo.createFixedExpense({
          user_id: userId,
          name: expense.name,
          amount: expense.amount,
          due_day: expense.dueDay,
          category: expense.category,
        });
      }
    }

    // Create behavior event for plan creation
    await this.supabaseRepo.createBehaviorEvent({
      user_id: userId,
      type: 'plan_created',
      payload: {
        planId,
        planType: assignment.planType,
        incomePattern: assignment.incomePattern,
      },
    });

    return {
      planId,
      pockets: createdPockets.map(p => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        category: p.category || undefined,
        monthlyAllocation: p.monthly_allocation,
        dailyCap: p.daily_cap || undefined,
      })),
    };
  }

  /**
   * Behavior check-in retake: re-runs the rules engine, creates a new plan
   * and pocket set, then migrates ledger balances from the previous active
   * plan so existing money is preserved and redistributed — unlike commit(),
   * which deliberately starts pockets empty.
   */
  async retake(rawInput: unknown, userId: string): Promise<PlanRetakeResult> {
    const input = this.parseInput(rawInput);

    const eligibility = await this.getRetakeEligibility(userId);
    if (!eligibility.allowed) {
      throw new HttpException(
        eligibility.message ?? 'You can only retake the behavior check-in once per month.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const previousPlan = await this.supabaseRepo.getActivePlanByUserId(userId);
    if (!previousPlan) {
      throw new NotFoundException('No active plan to retake. Complete onboarding first.');
    }

    const previousPockets = await this.supabaseRepo.getPocketsByPlanId(previousPlan.id);
    const sources: RedistributionSource[] = await Promise.all(
      previousPockets.map(async (pocket) => {
        const summary = await this.supabaseRepo.getPocketSummary(pocket.id);
        return {
          id: pocket.id,
          name: pocket.name,
          kind: pocket.kind as PocketKind,
          category: pocket.category,
          available: summary.available,
        };
      }),
    );

    const assignment = assignPlan(input);
    const planId = uuidv4();
    const dbIncomePattern = assignment.incomePattern === 'mix' ? 'salaried' : assignment.incomePattern;

    // Schema enforces one active plan per user (partial unique index), so we
    // must deactivate the old plan before inserting the new one. Snapshot of
    // balances already happened above; ledger rows stay on old pocket ids and
    // are moved via reallocation_* txs after the new pockets exist. If the
    // create/migrate path fails, re-activate the previous plan so the user is
    // not left without an active plan.
    await this.supabaseRepo.deactivateUserPlans(userId);

    let createdPockets;
    let movementPlans;
    try {
      const plan = await this.supabaseRepo.createPlan({
        id: planId,
        user_id: userId,
        type: assignment.planType,
        income_pattern: dbIncomePattern,
        income_interval_days: assignment.incomeIntervalDays ?? null,
        status: 'active',
      });

      if (!plan) {
        throw new Error('Failed to create plan');
      }

      const pocketInputs = buildPocketInputs(planId, assignment, input);
      createdPockets = await this.supabaseRepo.createPockets(pocketInputs);

      const targets: RedistributionTarget[] = createdPockets.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind as PocketKind,
        category: p.category,
        monthlyAllocation: p.monthly_allocation,
      }));

      movementPlans = planBalanceRedistribution(sources, targets);
      if (movementPlans.length > 0) {
        const ledgerRows = movementPlans.flatMap((m) => [
          { pocket_id: m.fromPocketId, amount: -m.amount, type: 'reallocation_out' as const },
          { pocket_id: m.toPocketId, amount: m.amount, type: 'reallocation_in' as const },
        ]);
        await this.supabaseRepo.createTransactions(ledgerRows);
      }
    } catch (error) {
      await this.supabaseRepo.updatePlan(previousPlan.id, { status: 'active' });
      throw error;
    }

    if (input.fixedExpenses !== undefined) {
      await this.supabaseRepo.deleteFixedExpensesByUserId(userId);
      for (const expense of input.fixedExpenses) {
        await this.supabaseRepo.createFixedExpense({
          user_id: userId,
          name: expense.name,
          amount: expense.amount,
          due_day: expense.dueDay,
          category: expense.category,
        });
      }
    }

    const totalMoved = round2(movementPlans.reduce((sum, m) => sum + m.amount, 0));
    const nextAvailable = nextRetakeAvailableOn();

    await this.supabaseRepo.createBehaviorEvent({
      user_id: userId,
      type: 'plan_retaken',
      payload: {
        previousPlanId: previousPlan.id,
        planId,
        planType: assignment.planType,
        incomePattern: assignment.incomePattern,
        totalMoved,
        movementCount: movementPlans.length,
      },
    });

    return {
      planId,
      pockets: createdPockets.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        category: p.category || undefined,
        monthlyAllocation: p.monthly_allocation,
        dailyCap: p.daily_cap || undefined,
      })),
      redistribution: {
        totalMoved,
        movements: movementPlans.map((m) => ({
          fromPocketName: m.fromPocketName,
          toPocketName: m.toPocketName,
          amount: m.amount,
          reason: m.reason,
        })),
        previousPlanType: previousPlan.type as PlanType,
        newPlanType: assignment.planType,
        nextRetakeAvailableOn: nextAvailable,
      },
    };
  }

  async getRetakeEligibility(userId: string): Promise<RetakeEligibility> {
    const events = await this.supabaseRepo.getBehaviorEventsByUserId(userId, 100);
    const lastRetake = events.find((e) => e.type === 'plan_retaken');
    if (!lastRetake) {
      return { allowed: true, nextRetakeAvailableOn: null, lastRetakenAt: null };
    }

    if (sameUtcMonth(lastRetake.created_at)) {
      const next = nextRetakeAvailableOn(new Date(lastRetake.created_at));
      return {
        allowed: false,
        nextRetakeAvailableOn: next,
        lastRetakenAt: lastRetake.created_at,
        message: `You can retake the behavior check-in once per month. Next available on ${next}.`,
      };
    }

    return {
      allowed: true,
      nextRetakeAvailableOn: null,
      lastRetakenAt: lastRetake.created_at,
    };
  }

  // Schema check first (shape/types), then the domain rules — both run on
  // every entry point so unvalidated client payloads never reach the rules
  // engine or the database.
  private parseInput(input: unknown): OnboardingInput {
    const result = OnboardingInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    const errors = validateOnboardingInput(result.data);
    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }
    return result.data;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}