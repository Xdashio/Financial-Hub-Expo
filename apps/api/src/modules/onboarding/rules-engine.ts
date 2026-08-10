import type {
  OnboardingInput,
  PlanAssignReason,
  PlanName,
  PlanType,
  IncomePattern,
  NeedsBand,
  EmergencyBuffer,
  MoneyPersonality,
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
  needsRatio: number;
  needsBand: NeedsBand;
  // Freelancer-only; undefined for salaried/mix. Day-count estimate derived
  // from the onboarding band — see docs/FREELANCER_RUNWAY.md.
  incomeIntervalDays?: number;
}

/** Floor savings rate of remaining-after-fixed when no buffer answer exists. */
export const MIN_SAVINGS_RATE = 0.10;

/** Needs-ratio bands from ONBOARDING_AND_SCORING_REDESIGN.md §2.4. */
export const NEEDS_RATIO_HIGH = 0.7;
export const NEEDS_RATIO_MID = 0.4;

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

  const concentration =
    input.sourceCount >= 4
      ? 'from several different places'
      : input.sourceCount >= 2
        ? 'from a few different places'
        : 'mostly from one place';

  return {
    pattern: 'freelancer',
    reason: {
      rule: 'income_pattern_freelancer',
      reason: `Your income is irregular and lumpy (freelancer), arriving ${concentration} at unpredictable times.`,
    },
  };
}

export function computeNeedsRatio(incomeAmount: number, fixedTotal: number): number {
  if (incomeAmount <= 0) return 0;
  return fixedTotal / incomeAmount;
}

export function classifyNeedsBand(needsRatio: number): NeedsBand {
  if (needsRatio >= NEEDS_RATIO_HIGH) return 'high';
  if (needsRatio >= NEEDS_RATIO_MID) return 'mid';
  return 'low';
}

function percentLabel(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function determineAllocationStyle(
  input: OnboardingInput,
  needsRatio: number,
  needsBand: NeedsBand,
): { planType: PlanType; reason: PlanAssignReason } {
  const { spendingHabit } = input;
  const personality: MoneyPersonality = input.moneyPersonality ?? 'saver';
  const pct = percentLabel(needsRatio);

  // High needs (≥70%): daily regardless of habit — not enough room for category pockets.
  if (needsBand === 'high') {
    return {
      planType: 'daily',
      reason: {
        rule: 'allocation_style_daily_high_needs',
        reason: `Rent, bills and other fixed costs take up ${pct} of what you told us you earn — that doesn't leave much room for category pockets, so we're giving you daily caps instead.`,
        needsRatio,
        needsBand,
      },
    };
  }

  // Low needs (<40%): structured is viable, but weak spending discipline still leans daily.
  if (needsBand === 'low') {
    if (spendingHabit === 'week3' || spendingHabit === 'off_guard') {
      return {
        planType: 'daily',
        reason: {
          rule: 'allocation_style_daily_habit_override',
          reason:
            spendingHabit === 'week3'
              ? `Fixed costs are only ${pct} of income, but you tend to run low by week 3 — daily caps prevent the end-of-month crunch.`
              : `Fixed costs are only ${pct} of income, but expenses often catch you off guard — daily caps act as guardrails.`,
          needsRatio,
          needsBand,
        },
      };
    }

    if (personality === 'spender' && spendingHabit !== 'tracker') {
      return {
        planType: 'daily',
        reason: {
          rule: 'allocation_style_daily_spender_mid_discipline',
          reason: `Fixed costs leave room (${pct} of income), but your money style leans toward spending freely — daily caps keep that honest without judgment.`,
          needsRatio,
          needsBand,
        },
      };
    }

    return {
      planType: 'structured',
      reason: {
        rule: 'allocation_style_structured_low_needs',
        reason: `Fixed costs are about ${pct} of income, so there's enough left to divide meaningfully into category pockets.`,
        needsRatio,
        needsBand,
      },
    };
  }

  // Mid band (40–70%): habit + personality decide.
  if (spendingHabit === 'week3' || spendingHabit === 'off_guard') {
    return {
      planType: 'daily',
      reason: {
        rule: 'allocation_style_daily_mid_habit',
        reason:
          spendingHabit === 'week3'
            ? `Fixed costs take about ${pct} of income — a tight middle band — and you notice money running low around week 3, so daily caps fit.`
            : `Fixed costs take about ${pct} of income — a tight middle band — and expenses often catch you off guard, so daily caps fit.`,
        needsRatio,
        needsBand,
      },
    };
  }

  if (personality === 'spender') {
    return {
      planType: 'daily',
      reason: {
        rule: 'allocation_style_daily_mid_spender',
        reason: `Fixed costs take about ${pct} of income. Because unexpected money tends to get spent, daily caps give clearer day-to-day guardrails.`,
        needsRatio,
        needsBand,
      },
    };
  }

  // tracker + saver/avoider (or default) → structured
  return {
    planType: 'structured',
    reason: {
      rule: 'allocation_style_structured_mid_tracker',
      reason:
        personality === 'avoider'
          ? `Fixed costs take about ${pct} of income. You track spending and prefer not to over-decide — structured pockets keep things clear without constant checking.`
          : `Fixed costs take about ${pct} of income, and you track spending closely — structured pockets fit that rhythm.`,
      needsRatio,
      needsBand,
    },
  };
}

function buildPlanName(incomePattern: IncomePattern, planType: PlanType): PlanName {
  const patternLabel = incomePattern === 'salaried' ? 'Salaried' : 'Freelancer';
  const styleLabel = planType === 'structured' ? 'Structured' : 'Daily Budget';
  return `${patternLabel} — ${styleLabel}` as PlanName;
}

/** Savings rate of remaining-after-fixed, personalized by emergency buffer (§2.2 / §4.2). */
export function savingsRateForBuffer(buffer?: EmergencyBuffer): number {
  switch (buffer) {
    case 'none':
      return 0.12;
    case 'under_month':
      return 0.1;
    case '1_to_3_months':
      return 0.08;
    case '3_plus_months':
      return 0.05;
    default:
      return MIN_SAVINGS_RATE;
  }
}

function calculateSavingsTarget(incomeAmount: number, fixedTotal: number, buffer?: EmergencyBuffer): number {
  const remainingAfterFixed = incomeAmount - fixedTotal;
  return Math.max(remainingAfterFixed * savingsRateForBuffer(buffer), 0);
}

export function assignPlan(input: OnboardingInput): PlanAssignment {
  const { incomeAmount, fixedTotal } = input;

  const remainingAfterFixed = incomeAmount - fixedTotal;
  if (remainingAfterFixed <= 0) {
    throw new Error('Fixed expenses exceed income — cannot assign a plan');
  }

  const needsRatio = computeNeedsRatio(incomeAmount, fixedTotal);
  const needsBand = classifyNeedsBand(needsRatio);

  const { pattern: resolvedIncomePattern, reason: patternReason } = determineIncomePattern(input);
  const { planType, reason: styleReason } = determineAllocationStyle(input, needsRatio, needsBand);
  const plan = buildPlanName(resolvedIncomePattern, planType);

  const savingsTarget = calculateSavingsTarget(incomeAmount, fixedTotal, input.emergencyBuffer);
  const spendableAmount = remainingAfterFixed - savingsTarget;

  const reasons: PlanAssignReason[] = [patternReason, styleReason];

  if (input.hasDependents === true) {
    reasons.push({
      rule: 'persona_dependents',
      reason: 'You regularly support others — we include a Family & obligations pocket so that spend has a clear home.',
    });
  }

  if (input.lifeStage === 'student') {
    reasons.push({
      rule: 'persona_student',
      reason: 'As a student, spending is usually less category-split — one Daily spend pocket keeps the plan simple.',
    });
  }

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
    needsRatio,
    needsBand,
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
