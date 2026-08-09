import { Injectable, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  OnboardingInputSchema,
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
  PocketKind,
  PocketCategory,
} from '@financial-hub/shared';
import { assignPlan, PlanAssignment, validateOnboardingInput } from './rules-engine';
import { SupabaseRepository } from '../../database/supabase.repository';

type SpendableCategory = 'food' | 'transport' | 'leisure';

const SPENDABLE_CATEGORIES: SpendableCategory[] = ['food', 'transport', 'leisure'];
const CATEGORY_NAMES: Record<SpendableCategory, string> = {
  food: 'Food & Groceries',
  transport: 'Transport',
  leisure: 'Personal & Leisure',
};

// Default savings time-lock length applied at plan creation. Short locks
// (30-60 days) are best for habit-building; 30 days is the floor.
const DEFAULT_SAVINGS_LOCK_DAYS = 30;

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
      status: 'active',
    });

    if (!plan) {
      throw new Error('Failed to create plan');
    }

    // Create pockets
    // monthly_allocation is a planning ceiling only — it tells the app how
    // to split income when it actually arrives (via POST /income/manual).
    // No allocation transactions are written here: the user's onboarding
    // income figure is behavioural input, not a deposit. Real money only
    // enters the ledger when the user logs an income event.
    const pocketInputs = this.createPocketInputs(planId, assignment, input.incomeAmount, input.fixedTotal);
    const createdPockets = await this.supabaseRepo.createPockets(pocketInputs);

    // Create fixed expenses
    for (const expense of input.fixedExpenses || []) {
      await this.supabaseRepo.createFixedExpense({
        user_id: userId,
        name: expense.name,
        amount: expense.amount,
        due_day: expense.dueDay,
        category: expense.category,
      });
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

  private createPocketInputs(
    planId: string,
    assignment: PlanAssignment,
    incomeAmount: number,
    fixedTotal: number
  ): any[] {
    const pockets = [];

    const fixedPocketId = uuidv4();
    pockets.push({
      id: fixedPocketId,
      plan_id: planId,
      name: 'Fixed Expenses',
      kind: 'fixed' as PocketKind,
      category: null,
      is_time_locked: false,
      lock_until: null,
      monthly_allocation: fixedTotal,
      daily_cap: null,
    });

    const savingsPocketId = uuidv4();
    const lockUntil = new Date();
    lockUntil.setDate(lockUntil.getDate() + DEFAULT_SAVINGS_LOCK_DAYS);
    pockets.push({
      id: savingsPocketId,
      plan_id: planId,
      name: 'Savings',
      kind: 'savings' as PocketKind,
      category: null,
      is_time_locked: true,
      lock_until: lockUntil.toISOString(),
      monthly_allocation: assignment.savingsTarget,
      daily_cap: null,
    });

    if (assignment.planType === 'structured') {
      const spendableAmount = assignment.spendableAmount;
      const perPocketAmount = spendableAmount / SPENDABLE_CATEGORIES.length;

      for (const category of SPENDABLE_CATEGORIES) {
        pockets.push({
          id: uuidv4(),
          plan_id: planId,
          name: CATEGORY_NAMES[category],
          kind: 'spendable' as PocketKind,
          category: category as PocketCategory,
          is_time_locked: false,
          lock_until: null,
          monthly_allocation: perPocketAmount,
          daily_cap: null,
        });
      }
    } else {
      const daysInMonth = 30;
      const dailySpendable = assignment.spendableAmount / daysInMonth;

      for (const category of SPENDABLE_CATEGORIES) {
        const dailyCap = dailySpendable / SPENDABLE_CATEGORIES.length;
        pockets.push({
          id: uuidv4(),
          plan_id: planId,
          name: CATEGORY_NAMES[category],
          kind: 'spendable' as PocketKind,
          category: category as PocketCategory,
          is_time_locked: false,
          lock_until: null,
          monthly_allocation: dailyCap * daysInMonth,
          daily_cap: Math.round(dailyCap * 100) / 100,
        });
      }
    }

    return pockets;
  }


}