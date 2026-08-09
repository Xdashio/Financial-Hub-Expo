import type {
  OnboardingInput,
  PlanAssignReason,
  PlanName,
  PlanType,
  IncomePattern,
} from '@financial-hub/shared';
import { IncomeIntervalDaysByBand } from '@financial-hub/shared';

export interface PlanAssignment {
  plan: PlanName;
  planType: PlanType;
  incomePattern: IncomePattern;
  reasons: PlanAssignReason[];
  remainingAfterFixed: number;
  savingsTarget: number;
  spendableAmount: number;
  // Freelancer-only; undefined for salaried/mix. Day-count estimate derived
  // from the onboarding band — see docs/FREELANCER_RUNWAY.md.
  incomeIntervalDays?: number;
}

const MIN_SAVINGS_RATE = 0.10;

function determineIncomePattern(input: OnboardingInput): { pattern: IncomePattern; reason: PlanAssignReason } {
  const { incomePattern } = input;

  if (incomePattern === 'salaried') {
    return {
      pattern: 'salaried',
      reason: {
        rule: 'income_pattern_salaried',
        reason: 'Your income arrives on a regular, predictable schedule (salaried).',
      },
    };
  }

  if (incomePattern === 'mix') {
    return {
      pattern: 'salaried',
      reason: {
        rule: 'income_pattern_mix_stable_base',
        reason: 'You have a stable base income with occasional variable earnings — treated as salaried for plan stability.',
      },
    };
  }

  return {
    pattern: 'freelancer',
    reason: {
      rule: 'income_pattern_freelancer',
      reason: 'Your income is irregular and lumpy (freelancer), arriving from multiple sources at unpredictable times.',
    },
  };
}

function determineAllocationStyle(
  input: OnboardingInput,
  _incomePattern: IncomePattern
): { planType: PlanType; reason: PlanAssignReason } {
  const { spendingHabit, incomeAmount, fixedTotal } = input;
  const remainingAfterFixed = incomeAmount - fixedTotal;

  if (spendingHabit === 'week3' || spendingHabit === 'off_guard') {
    return {
      planType: 'daily',
      reason: {
        rule: 'allocation_style_daily_budget',
        reason:
          spendingHabit === 'week3'
            ? 'You tend to run low by week 3 — daily caps prevent the end-of-month crunch.'
            : 'You often get caught off guard by expenses — daily caps act as guardrails to keep spending in check.',
      },
    };
  }

  const twentyPercentOfIncome = incomeAmount * 0.20;
  if (spendingHabit === 'tracker' && remainingAfterFixed >= twentyPercentOfIncome) {
    return {
      planType: 'structured',
      reason: {
        rule: 'allocation_style_structured',
        reason:
          'You track your spending closely, and there\'s enough remaining after fixed costs to divide meaningfully into pockets.',
      },
    };
  }

  return {
    planType: 'daily',
    reason: {
      rule: 'allocation_style_daily_budget_fallback',
      reason:
        'Daily caps provide clearer guardrails when the remaining amount is less than 20% of your income.',
    },
  };
}

function buildPlanName(incomePattern: IncomePattern, planType: PlanType): PlanName {
  const patternLabel = incomePattern === 'salaried' ? 'Salaried' : 'Freelancer';
  const styleLabel = planType === 'structured' ? 'Structured' : 'Daily Budget';
  return `${patternLabel} — ${styleLabel}` as PlanName;
}

function calculateSavingsTarget(incomeAmount: number, fixedTotal: number): number {
  const remainingAfterFixed = incomeAmount - fixedTotal;
  return Math.max(remainingAfterFixed * MIN_SAVINGS_RATE, 0);
}

export function assignPlan(input: OnboardingInput): PlanAssignment {
  const { incomeAmount, fixedTotal } = input;

  const remainingAfterFixed = incomeAmount - fixedTotal;
  if (remainingAfterFixed <= 0) {
    throw new Error('Fixed expenses exceed income — cannot assign a plan');
  }

  const { pattern: resolvedIncomePattern, reason: patternReason } = determineIncomePattern(input);
  const { planType, reason: styleReason } = determineAllocationStyle(input, resolvedIncomePattern);
  const plan = buildPlanName(resolvedIncomePattern, planType);

  const savingsTarget = calculateSavingsTarget(incomeAmount, fixedTotal);
  const spendableAmount = remainingAfterFixed - savingsTarget;

  const reasons: PlanAssignReason[] = [patternReason, styleReason];

  const incomeIntervalDays =
    resolvedIncomePattern === 'freelancer' && input.incomeIntervalBand
      ? IncomeIntervalDaysByBand[input.incomeIntervalBand]
      : undefined;

  return {
    plan,
    planType,
    incomePattern: resolvedIncomePattern,
    reasons,
    remainingAfterFixed,
    savingsTarget,
    spendableAmount,
    incomeIntervalDays,
  };
}

export function validateOnboardingInput(input: OnboardingInput): string[] {
  const errors: string[] = [];

  if (input.incomeAmount <= 0) {
    errors.push('Income amount must be positive');
  }

  if (input.fixedTotal < 0) {
    errors.push('Fixed total cannot be negative');
  }

  if (input.sourceCount <= 0) {
    errors.push('Source count must be at least 1');
  }

  if (input.fixedTotal >= input.incomeAmount) {
    errors.push('Fixed expenses cannot exceed or equal income');
  }

  // Freelancers need a pay-cadence estimate for the runway calculation
  // (RunwaySummary falls back to this until real income_events history
  // exists — see docs/FREELANCER_RUNWAY.md). Salaried/mix income is
  // treated as a fixed monthly cycle and doesn't need this.
  if (input.incomePattern === 'freelancer' && !input.incomeIntervalBand) {
    errors.push('incomeIntervalBand is required when incomePattern is freelancer');
  }

  return errors;
}