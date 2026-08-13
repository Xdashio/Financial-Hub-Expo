import type {
  OnboardingInput,
  PlanAssignReason,
  PlanName,
  PlanType,
  IncomePattern,
  IncomeConcentration,
  NeedsBand,
  EmergencyBuffer,
  MoneyPersonality,
  SavingsGoalInput,
  SavingsGoalType,
} from '@financial-hub/shared';
import { IncomeIntervalDaysByBand, SavingsGoalTimeframeMonths, SavingsGoalLockDays } from '@financial-hub/shared';

export interface PlanAssignment {
  plan: PlanName;
  planType: PlanType;
  incomePattern: IncomePattern;
  // Income-concentration split within 'freelancer' (audit_team.md item 8,
  // Batch 4 / ONBOARDING_AND_SCORING_REDESIGN.md §2.1) — gig/platform-style
  // concentrated income vs. genuinely diversified multi-client freelancing.
  // Undefined for salaried/mix. Display/reasons only: the stored
  // `incomePattern` stays 'freelancer' either way, so runway/rollover/nudge
  // logic (which gates on `income_pattern === 'freelancer'`) is unaffected.
  incomeConcentration?: IncomeConcentration;
  // Set only when the onboarding answer was 'mix' (audit_team.md item 2 —
  // salaried-with-side-income persona). Undefined for pure 'salaried' and
  // for 'freelancer'. Stored `incomePattern` stays 'salaried' either way —
  // display/reasons only, same posture as `incomeConcentration` above.
  hasSideIncome?: boolean;
  reasons: PlanAssignReason[];
  remainingAfterFixed: number;
  savingsTarget: number;
  // Days the Savings pocket locks for each cycle. Goal-derived when a
  // savings goal was captured (§4.2 — shorter-horizon goals get shorter
  // lock cycles), otherwise DEFAULT_SAVINGS_LOCK_DAYS.
  savingsLockDays: number;
  spendableAmount: number;
  needsRatio: number;
  needsBand: NeedsBand;
  // Freelancer-only; undefined for salaried/mix. Day-count estimate derived
  // from the onboarding band — see docs/FREELANCER_RUNWAY.md.
  incomeIntervalDays?: number;
}

/** Floor savings rate of remaining-after-fixed when no buffer answer exists. */
export const MIN_SAVINGS_RATE = 0.10;

/** Default Savings pocket lock length (days) when no goal was captured —
 *  single source of truth, imported by pocket-provisioning.ts rather than
 *  duplicated there. */
export const DEFAULT_SAVINGS_LOCK_DAYS = 30;

/** Absolute floor savings rate — never goes lower regardless of goal size or
 *  needs ratio (scoping answer 6: "derived rate, minimum 5%"). Buffer-based
 *  rates (savingsRateForBuffer) already sit at or above this; this floor is
 *  what actually binds on the goal-derived path when a goal is small or far
 *  out. */
export const ABSOLUTE_SAVINGS_FLOOR_RATE = 0.05;

/** "Sane share" ceiling on how much of remaining-after-fixed a goal-derived
 *  rate can claim before we stop silently forcing it and surface a
 *  shortfall back to the user instead (§4.2: "don't silently force it —
 *  surface it back to the user"). Keeps savings from claiming more than
 *  half of what's left after fixed costs, so spendable always keeps a
 *  meaningful floor. */
export const SAVINGS_GOAL_CAP_SHARE = 0.5;

/** Needs-ratio bands from ONBOARDING_AND_SCORING_REDESIGN.md §2.4. */
export const NEEDS_RATIO_HIGH = 0.7;
export const NEEDS_RATIO_MID = 0.4;

/**
 * Income-concentration threshold (audit_team.md item 8, Batch 4).
 * `sourceCount` is the only concentration signal collected at onboarding
 * today (no per-source income share) — §2.1's research framing is ">50-75%
 * of income from one or few platform sources" for gig/platform workers, so
 * a low source count is used as the proxy: 1-2 sources reads as
 * concentrated/gig-style, 3+ reads as genuinely diversified multi-client
 * freelancing. Documented here as a named constant (not inlined) so it's
 * inspectable and revisitable the same way NEEDS_RATIO_HIGH/MID are.
 */
export const GIG_CONCENTRATION_MAX_SOURCES = 2;

function determineIncomeConcentration(sourceCount: number): IncomeConcentration {
  return sourceCount <= GIG_CONCENTRATION_MAX_SOURCES ? 'concentrated' : 'diversified';
}

function determineIncomePattern(input: OnboardingInput): {
  pattern: IncomePattern;
  concentration?: IncomeConcentration;
  hasSideIncome?: boolean;
  reason: PlanAssignReason;
} {
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
    // Salaried-with-side-income persona (audit_team.md item 2 /
    // ONBOARDING_AND_SCORING_REDESIGN.md §2.1's "stable core, flexible
    // edge" framing) — previously collapsed into an undifferentiated
    // 'salaried' reason string. Stored pattern still resolves to 'salaried'
    // (runway/rollover logic keys off that), but the persona is now
    // surfaced distinctly for plan naming and copy.
    return {
      pattern: 'salaried',
      hasSideIncome: true,
      reason: {
        rule: 'income_pattern_salaried_side_income',
        reason:
          'You have a stable base income plus irregular side income — we keep your core plan steady like a salaried budget, while leaving room for the extra to move around.',
      },
    };
  }

  const concentration = determineIncomeConcentration(input.sourceCount);

  if (concentration === 'concentrated') {
    return {
      pattern: 'freelancer',
      concentration,
      reason: {
        rule: 'income_pattern_freelancer_gig',
        reason:
          'Most of your income comes from one or a couple of platforms — gig/platform-style income. It can swing day to day, but usually follows a payout rhythm rather than being fully unpredictable.',
      },
    };
  }

  return {
    pattern: 'freelancer',
    concentration,
    reason: {
      rule: 'income_pattern_freelancer_multi_client',
      reason:
        'Your income comes from several different clients or sources — genuinely irregular and lumpy (freelancer), arriving at unpredictable times.',
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

function buildPlanName(
  incomePattern: IncomePattern,
  planType: PlanType,
  concentration?: IncomeConcentration,
  hasSideIncome?: boolean,
): PlanName {
  const patternLabel =
    incomePattern === 'salaried'
      ? hasSideIncome
        ? 'Salaried + Side Income'
        : 'Salaried'
      : concentration === 'concentrated'
        ? 'Gig'
        : 'Freelancer';
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

function calculateSavingsTarget(
  incomeAmount: number,
  fixedTotal: number,
  buffer?: EmergencyBuffer,
  goal?: SavingsGoalInput,
): {
  savingsTarget: number;
  savingsLockDays: number;
  goalShortfall?: { goalMonthsNeeded: number; goalRequiredSharePercent: number };
} {
  const remainingAfterFixed = incomeAmount - fixedTotal;
  const bufferRate = savingsRateForBuffer(buffer);

  // No goal, or a goal without a stated amount (user skipped "roughly how
  // much") — fall back to the buffer-based rate (§4.2 point 3: "fall back
  // to the 5% floor plus whatever the existing needs-ratio-based
  // calculation already produces"), still never below the absolute floor.
  // A goal timeframe with no amount still personalizes the lock length,
  // since that part of the question was answered.
  if (!goal || !goal.goalAmount) {
    const rate = Math.max(bufferRate, ABSOLUTE_SAVINGS_FLOOR_RATE);
    return {
      savingsTarget: Math.max(remainingAfterFixed * rate, 0),
      savingsLockDays: goal ? SavingsGoalLockDays[goal.goalTimeframe] : DEFAULT_SAVINGS_LOCK_DAYS,
    };
  }

  const savingsLockDays = SavingsGoalLockDays[goal.goalTimeframe];

  // remainingAfterFixed <= 0 is already rejected in assignPlan before this
  // runs, so this division is always against a positive number here.
  const monthsToTarget = SavingsGoalTimeframeMonths[goal.goalTimeframe];
  const monthlyRequired = goal.goalAmount / monthsToTarget;
  const derivedRate = monthlyRequired / remainingAfterFixed;
  const flooredRate = Math.max(derivedRate, bufferRate, ABSOLUTE_SAVINGS_FLOOR_RATE);

  if (flooredRate <= SAVINGS_GOAL_CAP_SHARE) {
    return {
      savingsTarget: Math.max(remainingAfterFixed * flooredRate, 0),
      savingsLockDays,
    };
  }

  // Derived rate would eat more than the sane-share cap — cap it rather
  // than forcing it, and carry the real numbers so the client can show
  // "this would take ~N months longer" / "would need ~X% of your
  // spendable income" instead of failing silently or overcommitting.
  const cappedMonthlyAmount = remainingAfterFixed * SAVINGS_GOAL_CAP_SHARE;
  return {
    savingsTarget: Math.max(cappedMonthlyAmount, 0),
    savingsLockDays,
    goalShortfall: {
      goalMonthsNeeded: goal.goalAmount / cappedMonthlyAmount,
      goalRequiredSharePercent: derivedRate * 100,
    },
  };
}

function goalDisplayLabel(goal: SavingsGoalInput): string {
  if (goal.goalLabel) {
    return goal.goalLabel;
  }
  const byType: Record<SavingsGoalType, string> = {
    emergency_fund: 'your emergency fund',
    purchase: 'your goal',
    dependent_education: "a dependent's education goal",
    other: 'your savings goal',
  };
  return byType[goal.goalType];
}

export function assignPlan(input: OnboardingInput): PlanAssignment {
  const { incomeAmount, fixedTotal } = input;

  const remainingAfterFixed = incomeAmount - fixedTotal;
  if (remainingAfterFixed <= 0) {
    throw new Error('Fixed expenses exceed income — cannot assign a plan');
  }

  const needsRatio = computeNeedsRatio(incomeAmount, fixedTotal);
  const needsBand = classifyNeedsBand(needsRatio);

  const {
    pattern: resolvedIncomePattern,
    concentration,
    hasSideIncome,
    reason: patternReason,
  } = determineIncomePattern(input);
  const { planType, reason: styleReason } = determineAllocationStyle(input, needsRatio, needsBand);
  const plan = buildPlanName(resolvedIncomePattern, planType, concentration, hasSideIncome);

  const savingsTargetResult = calculateSavingsTarget(
    incomeAmount,
    fixedTotal,
    input.emergencyBuffer,
    input.savingsGoal,
  );
  const { savingsTarget, savingsLockDays, goalShortfall } = savingsTargetResult;
  const spendableAmount = remainingAfterFixed - savingsTarget;

  const reasons: PlanAssignReason[] = [patternReason, styleReason];

  if (input.savingsGoal?.goalAmount) {
    const label = goalDisplayLabel(input.savingsGoal);
    if (goalShortfall) {
      reasons.push({
        rule: 'savings_goal_capacity_shortfall',
        reason: `Hitting ${label} on your stated timeline would take about ${Math.round(goalShortfall.goalRequiredSharePercent)}% of what's left after fixed costs — more than we'd recommend committing at once, so we've capped it. At this rate the goal would take roughly ${Math.ceil(goalShortfall.goalMonthsNeeded)} months — want to adjust the goal, the timeline, or the rate?`,
        goalMonthsNeeded: goalShortfall.goalMonthsNeeded,
        goalRequiredSharePercent: goalShortfall.goalRequiredSharePercent,
      });
    } else {
      reasons.push({
        rule: 'savings_goal_on_track',
        reason: `We derived your savings rate from ${label} and your stated timeline — this pace should get you there on schedule.`,
      });
    }
  }

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
    incomeConcentration: concentration,
    hasSideIncome,
    reasons,
    remainingAfterFixed,
    savingsTarget,
    savingsLockDays,
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