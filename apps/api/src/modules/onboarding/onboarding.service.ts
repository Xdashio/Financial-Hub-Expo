import { Injectable, BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  OnboardingInputSchema,
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
  MsmeOnboardingInputSchema,
  MsmeOnboardingInput,
  PlanPreviewResult,
  PlanRetakeResult,
  RetakeEligibility,
  PocketKind,
  PlanType,
} from '@financial-hub/shared';
import { assignPlan, assignMsmePlan, validateOnboardingInput, validateMsmeOnboardingInput } from './rules-engine';
import { SupabaseRepository } from '../../database/supabase.repository';
import {
  nextRetakeAvailableOn,
  planBalanceRedistribution,
  sameUtcMonth,
  type RedistributionSource,
  type RedistributionTarget,
} from './plan-redistribution';
import {
  buildPocketInputs,
  buildMsmePocketInputs,
  previewSpendableBreakdown,
  resolveSpendableCategories,
  defaultCategoryPercentages,
  validateCategoryPercentages,
} from './pocket-provisioning';

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
      incomeConcentration: assignment.incomeConcentration,
      hasSideIncome: assignment.hasSideIncome,
      reasons: assignment.reasons,
      remainingAfterFixed: assignment.remainingAfterFixed,
      savingsTarget: assignment.savingsTarget,
      spendableAmount: assignment.spendableAmount,
      needsRatio: assignment.needsRatio,
      needsBand: assignment.needsBand,
    };
  }

  /** MSME onboarding preview (ADR-001 / MSME_PHASED_BUILD_PLAN §6.2) — always
   *  a structured plan, no daily caps. No persistence. */
  assignMsme(rawInput: unknown): OnboardingAssignResult {
    const input = this.parseMsmeInput(rawInput);

    const assignment = assignMsmePlan(input);

    return {
      segment: 'msme',
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

  /**
   * Pre-commit preview for the onboarding result screen's percentage editor
   * (audit_team.md item 3). Same assign() math, plus a per-category
   * breakdown of the spendable amount. If the caller supplies
   * `categoryPercentages`, they're validated (must cover exactly this
   * persona's categories and sum to 100) and used to compute the breakdown
   * instead of the rules engine's default weighting — this is a dry run,
   * nothing is persisted.
   */
  previewPlan(rawInput: unknown): PlanPreviewResult {
    const input = this.parseInput(rawInput);
    const assignment = assignPlan(input);
    const categoryBreakdown = previewSpendableBreakdown(assignment, input);
    const categories = resolveSpendableCategories(input);
    const categoryPercentages =
      input.categoryPercentages ?? defaultCategoryPercentages(categories, input);

    return {
      plan: assignment.plan,
      planType: assignment.planType,
      incomePattern: assignment.incomePattern,
      incomeConcentration: assignment.incomeConcentration,
      hasSideIncome: assignment.hasSideIncome,
      reasons: assignment.reasons,
      remainingAfterFixed: assignment.remainingAfterFixed,
      savingsTarget: assignment.savingsTarget,
      spendableAmount: assignment.spendableAmount,
      needsRatio: assignment.needsRatio,
      needsBand: assignment.needsBand,
      categoryBreakdown,
      categoryPercentages,
    };
  }

  async commit(rawInput: unknown, userId: string): Promise<OnboardingCommitResult> {
    const input = this.parseInput(rawInput);
    const assignment = assignPlan(input);
    const planId = uuidv4();

    // Segment-scoped: never deactivates the other segment's active plan (ADR-001 D1)
    await this.supabaseRepo.deactivateUserPlansBySegment(userId, 'individual');

    // Map income pattern: 'mix' -> 'salaried' for database
    const dbIncomePattern = assignment.incomePattern === 'mix' ? 'salaried' : assignment.incomePattern;

    // Create the new plan
    const plan = await this.supabaseRepo.createPlan({
      id: planId,
      user_id: userId,
      type: assignment.planType,
      income_pattern: dbIncomePattern,
      income_interval_days: assignment.incomeIntervalDays ?? null,
      expected_income_amount: input.incomeAmount ?? null,
      status: 'active',
      // Money-personality modifier layer (audit_team.md item 2 batch 2 /
      // ONBOARDING_AND_SCORING_REDESIGN.md §2.3) — persisted so it survives
      // past onboarding for reallocations/notifications/insights to read.
      // Falls back to 'saver', matching rules-engine.ts's own fallback for
      // a skipped answer.
      money_personality: input.moneyPersonality ?? 'saver',
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
      // Delete existing fixed expenses for this segment only — keeps the
      // other segment's bills intact (016_msme_phase2_segment_isolation).
      await this.supabaseRepo.deleteFixedExpensesByUserId(userId, 'individual');

      for (const expense of input.fixedExpenses) {
        await this.supabaseRepo.createFixedExpense({
          user_id: userId,
          name: expense.name,
          amount: expense.amount,
          due_day: expense.dueDay,
          category: expense.category,
          segment: 'individual',
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
        incomeConcentration: assignment.incomeConcentration,
        hasSideIncome: assignment.hasSideIncome,
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
   * MSME onboarding commit — creates a segment-scoped active plan plus the
   * MSME pocket set. Uses deactivateUserPlansBySegment so an existing active
   * *individual* plan stays live: ADR-001 D1 allows one active plan per
   * segment to coexist. `monthlyRevenue` maps to plans.expected_income_amount.
   */
  async commitMsme(rawInput: unknown, userId: string): Promise<OnboardingCommitResult> {
    const input = this.parseMsmeInput(rawInput);
    const assignment = assignMsmePlan(input);
    const planId = uuidv4();

    // Segment-scoped: never deactivates the individual segment's plan.
    await this.supabaseRepo.deactivateUserPlansBySegment(userId, 'msme');

    const plan = await this.supabaseRepo.createPlan({
      id: planId,
      user_id: userId,
      segment: 'msme',
      type: 'structured',
      // MSME always resolves to a monthly/structured rhythm — never 'mix',
      // and never stored as 'freelancer' (no daily-cap runway math applies).
      income_pattern: 'salaried',
      expected_income_amount: input.monthlyRevenue,
      status: 'active',
      money_personality: 'saver',
    });

    if (!plan) {
      throw new Error('Failed to create plan');
    }

    const pocketInputs = buildMsmePocketInputs(planId, assignment, input);
    const createdPockets = await this.supabaseRepo.createPockets(pocketInputs);

    if (input.fixedExpenses !== undefined) {
      await this.supabaseRepo.deleteFixedExpensesByUserId(userId, 'msme');
      for (const expense of input.fixedExpenses) {
        await this.supabaseRepo.createFixedExpense({
          user_id: userId,
          name: expense.name,
          amount: expense.amount,
          due_day: expense.dueDay,
          category: expense.category,
          segment: 'msme',
        });
      }
    }

    await this.supabaseRepo.createBehaviorEvent({
      user_id: userId,
      type: 'plan_created',
      payload: {
        planId,
        segment: 'msme',
        planType: assignment.planType,
        businessName: input.businessName,
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

    // Schema enforces one active plan per segment (partial unique index), so we
    // must deactivate the old plan before inserting the new one. Snapshot of
    // balances already happened above; ledger rows stay on old pocket ids and
    // are moved via reallocation_* txs after the new pockets exist. If the
    // create/migrate path fails, re-activate the previous plan so the user is
    // not left without an active plan. Segment-scoped so MSME is untouched.
    await this.supabaseRepo.deactivateUserPlansBySegment(userId, 'individual');

    let createdPockets;
    let movementPlans;
    try {
      const plan = await this.supabaseRepo.createPlan({
        id: planId,
        user_id: userId,
        type: assignment.planType,
        income_pattern: dbIncomePattern,
        income_interval_days: assignment.incomeIntervalDays ?? null,
        expected_income_amount: input.incomeAmount ?? null,
        status: 'active',
        // See the money_personality comment on the commit() createPlan call
        // above — same modifier-layer persistence, applies on retake too
        // since a retake can change the stated personality.
        money_personality: input.moneyPersonality ?? 'saver',
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
      await this.supabaseRepo.deleteFixedExpensesByUserId(userId, 'individual');
      for (const expense of input.fixedExpenses) {
        await this.supabaseRepo.createFixedExpense({
          user_id: userId,
          name: expense.name,
          amount: expense.amount,
          due_day: expense.dueDay,
          category: expense.category,
          segment: 'individual',
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
        incomeConcentration: assignment.incomeConcentration,
        hasSideIncome: assignment.hasSideIncome,
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
    const categoryErrors = validateCategoryPercentages(result.data);
    if (categoryErrors.length > 0) {
      throw new BadRequestException(categoryErrors.join('; '));
    }
    return result.data;
  }

  // MSME counterpart of parseInput — schema then domain rules.
  private parseMsmeInput(input: unknown): MsmeOnboardingInput {
    const result = MsmeOnboardingInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    const errors = validateMsmeOnboardingInput(result.data);
    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }
    return result.data;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}