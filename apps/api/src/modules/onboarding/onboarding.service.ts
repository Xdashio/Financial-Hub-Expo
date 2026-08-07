import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
  PocketKind,
  PocketCategory,
} from '@financial-hub/shared';
import { assignPlan, PlanAssignment, validateOnboardingInput } from './rules-engine';

type SpendableCategory = 'food' | 'transport' | 'leisure';

const SPENDABLE_CATEGORIES: SpendableCategory[] = ['food', 'transport', 'leisure'];
const CATEGORY_NAMES: Record<SpendableCategory, string> = {
  food: 'Food & Groceries',
  transport: 'Transport',
  leisure: 'Personal & Leisure',
};

@Injectable()
export class OnboardingService {
  assign(input: OnboardingInput): OnboardingAssignResult {
    const validationErrors = validateOnboardingInput(input);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('; '));
    }

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

  commit(input: OnboardingInput, _userId: string): OnboardingCommitResult {
    const assignment = assignPlan(input);
    const planId = uuidv4();

    const pockets = this.createPockets(planId, assignment, input.incomeAmount, input.fixedTotal);

    return {
      planId,
      pockets,
    };
  }

  private createPockets(
    planId: string,
    assignment: PlanAssignment,
    incomeAmount: number,
    fixedTotal: number
  ): OnboardingCommitResult['pockets'] {
    const pockets = [];

    const fixedPocketId = uuidv4();
    pockets.push({
      id: fixedPocketId,
      name: 'Fixed Expenses',
      kind: 'fixed' as PocketKind,
      monthlyAllocation: fixedTotal,
      dailyCap: undefined,
    });

    const savingsPocketId = uuidv4();
    pockets.push({
      id: savingsPocketId,
      name: 'Savings',
      kind: 'savings' as PocketKind,
      isTimeLocked: true,
      monthlyAllocation: assignment.savingsTarget,
      dailyCap: undefined,
    });

    if (assignment.planType === 'structured') {
      const spendableAmount = assignment.spendableAmount;
      const perPocketAmount = spendableAmount / SPENDABLE_CATEGORIES.length;

      for (const category of SPENDABLE_CATEGORIES) {
        pockets.push({
          id: uuidv4(),
          name: CATEGORY_NAMES[category],
          kind: 'spendable' as PocketKind,
          category: category as PocketCategory,
          monthlyAllocation: perPocketAmount,
          dailyCap: undefined,
        });
      }
    } else {
      const daysInMonth = 30;
      const dailySpendable = assignment.spendableAmount / daysInMonth;

      for (const category of SPENDABLE_CATEGORIES) {
        const dailyCap = dailySpendable / SPENDABLE_CATEGORIES.length;
        pockets.push({
          id: uuidv4(),
          name: CATEGORY_NAMES[category],
          kind: 'spendable' as PocketKind,
          category: category as PocketCategory,
          monthlyAllocation: dailyCap * daysInMonth,
          dailyCap: Math.round(dailyCap * 100) / 100,
        });
      }
    }

    return pockets;
  }
}