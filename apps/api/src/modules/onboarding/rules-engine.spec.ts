import type {
  OnboardingInput,
  IncomePattern,
  IncomeConcentration,
  SpendingHabit,
  PlanName,
  PlanType,
} from '@financial-hub/shared';
import type { PlanAssignment } from './rules-engine';
import { assignPlan, validateOnboardingInput, GIG_CONCENTRATION_MAX_SOURCES } from './rules-engine';

describe('Rules Engine — Plan Assignment', () => {
  const createInput = (overrides: Partial<OnboardingInput> = {}): OnboardingInput => {
    const base: OnboardingInput = {
      incomePattern: 'salaried',
      spendingHabit: 'tracker',
      incomeAmount: 100000,
      fixedTotal: 30000,
      sourceCount: 1,
      ...overrides,
    };
    if (base.incomePattern === 'freelancer' && !base.incomeIntervalBand) {
      base.incomeIntervalBand = 'monthly';
    }
    return base;
  };

  const expectPlan = (
    result: PlanAssignment,
    expectedPlan: PlanName,
    expectedPlanType: PlanType,
    expectedIncomePattern: IncomePattern,
    expectedConcentration?: IncomeConcentration,
  ) => {
    expect(result.plan).toBe(expectedPlan);
    expect(result.planType).toBe(expectedPlanType);
    expect(result.incomePattern).toBe(expectedIncomePattern);
    expect(result.incomeConcentration).toBe(expectedConcentration);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
    expect(result.remainingAfterFixed).toBeGreaterThan(0);
    expect(result.savingsTarget).toBeGreaterThanOrEqual(0);
    expect(result.spendableAmount).toBeGreaterThanOrEqual(0);
    expect(result.needsRatio).toBeGreaterThanOrEqual(0);
    expect(['high', 'mid', 'low']).toContain(result.needsBand);
  };

  describe('validateOnboardingInput', () => {
    it('returns empty array for valid input', () => {
      const errors = validateOnboardingInput(createInput());
      expect(errors).toHaveLength(0);
    });

    it('rejects non-positive income', () => {
      const errors = validateOnboardingInput(createInput({ incomeAmount: 0 }));
      expect(errors).toContain('Income amount must be positive');
    });

    it('rejects negative fixed total', () => {
      const errors = validateOnboardingInput(createInput({ fixedTotal: -100 }));
      expect(errors).toContain('Fixed total cannot be negative');
    });

    it('rejects zero source count', () => {
      const errors = validateOnboardingInput(createInput({ sourceCount: 0 }));
      expect(errors).toContain('Source count must be at least 1');
    });

    it('rejects when fixed exceeds income', () => {
      const errors = validateOnboardingInput(createInput({ fixedTotal: 100000 }));
      expect(errors).toContain('Fixed expenses cannot exceed or equal income');
    });

    it('rejects when fixed equals income', () => {
      const errors = validateOnboardingInput(createInput({ incomeAmount: 50000, fixedTotal: 50000 }));
      expect(errors).toContain('Fixed expenses cannot exceed or equal income');
    });

    it('collects multiple errors', () => {
      const errors = validateOnboardingInput(createInput({ incomeAmount: 0, sourceCount: 0 }));
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('assignPlan — table-driven tests for all combinations', () => {
    const testCases: Array<{
      name: string;
      input: OnboardingInput;
      expectedPlan: PlanName;
      expectedPlanType: PlanType;
      expectedIncomePattern: IncomePattern;
      expectedConcentration?: IncomeConcentration;
      description: string;
    }> = [
      {
        name: 'salaried + tracker + meaningful remainder → Structured',
        input: createInput({ incomePattern: 'salaried', spendingHabit: 'tracker', incomeAmount: 100000, fixedTotal: 30000 }),
        expectedPlan: 'Salaried — Structured',
        expectedPlanType: 'structured',
        expectedIncomePattern: 'salaried',
        description: 'Regular income, tracks spending, enough remaining to divide meaningfully',
      },
      {
        name: 'salaried + tracker + small remainder → Daily Budget',
        input: createInput({ incomePattern: 'salaried', spendingHabit: 'tracker', incomeAmount: 50000, fixedTotal: 48000 }),
        expectedPlan: 'Salaried — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'salaried',
        description: 'Regular income, tracks spending, but remaining too small to divide meaningfully',
      },
      {
        name: 'salaried + week3 → Daily Budget',
        input: createInput({ incomePattern: 'salaried', spendingHabit: 'week3', incomeAmount: 100000, fixedTotal: 30000 }),
        expectedPlan: 'Salaried — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'salaried',
        description: 'Regular income, runs low by week 3 → daily caps prevent crunch',
      },
      {
        name: 'salaried + off_guard → Daily Budget',
        input: createInput({ incomePattern: 'salaried', spendingHabit: 'off_guard', incomeAmount: 100000, fixedTotal: 30000 }),
        expectedPlan: 'Salaried — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'salaried',
        description: 'Regular income, caught off guard → daily caps provide guardrails',
      },
      {
        name: 'mix + tracker + meaningful remainder → Structured',
        input: createInput({ incomePattern: 'mix', spendingHabit: 'tracker', incomeAmount: 100000, fixedTotal: 30000 }),
        expectedPlan: 'Salaried + Side Income — Structured',
        expectedPlanType: 'structured',
        expectedIncomePattern: 'salaried',
        description: 'Mix with stable base treated as salaried, tracks spending, enough remaining',
      },
      {
        name: 'mix + tracker + small remainder → Daily Budget',
        input: createInput({ incomePattern: 'mix', spendingHabit: 'tracker', incomeAmount: 50000, fixedTotal: 48000 }),
        expectedPlan: 'Salaried + Side Income — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'salaried',
        description: 'Mix with stable base, tracks spending, but remaining too small',
      },
      {
        name: 'mix + week3 → Daily Budget',
        input: createInput({ incomePattern: 'mix', spendingHabit: 'week3', incomeAmount: 100000, fixedTotal: 30000 }),
        expectedPlan: 'Salaried + Side Income — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'salaried',
        description: 'Mix with stable base, runs low by week 3 → daily caps',
      },
      {
        name: 'mix + off_guard → Daily Budget',
        input: createInput({ incomePattern: 'mix', spendingHabit: 'off_guard', incomeAmount: 100000, fixedTotal: 30000 }),
        expectedPlan: 'Salaried + Side Income — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'salaried',
        description: 'Mix with stable base, caught off guard → daily caps',
      },
      {
        name: 'freelancer (diversified, 3+ sources) + tracker + meaningful remainder → Structured',
        input: createInput({
          incomePattern: 'freelancer',
          spendingHabit: 'tracker',
          incomeAmount: 100000,
          fixedTotal: 30000,
          sourceCount: 4,
        }),
        expectedPlan: 'Freelancer — Structured',
        expectedPlanType: 'structured',
        expectedIncomePattern: 'freelancer',
        expectedConcentration: 'diversified',
        description: 'Irregular multi-client income, tracks spending, enough remaining to divide',
      },
      {
        name: 'freelancer (diversified, 3+ sources) + tracker + small remainder → Daily Budget',
        input: createInput({
          incomePattern: 'freelancer',
          spendingHabit: 'tracker',
          incomeAmount: 50000,
          fixedTotal: 48000,
          sourceCount: 4,
        }),
        expectedPlan: 'Freelancer — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'freelancer',
        expectedConcentration: 'diversified',
        description: 'Irregular multi-client income, tracks spending, but remaining too small',
      },
      {
        name: 'freelancer (diversified, 3+ sources) + week3 → Daily Budget',
        input: createInput({
          incomePattern: 'freelancer',
          spendingHabit: 'week3',
          incomeAmount: 100000,
          fixedTotal: 30000,
          sourceCount: 4,
        }),
        expectedPlan: 'Freelancer — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'freelancer',
        expectedConcentration: 'diversified',
        description: 'Irregular multi-client income, runs low by week 3 → daily caps',
      },
      {
        name: 'freelancer (diversified, 3+ sources) + off_guard → Daily Budget',
        input: createInput({
          incomePattern: 'freelancer',
          spendingHabit: 'off_guard',
          incomeAmount: 100000,
          fixedTotal: 30000,
          sourceCount: 4,
        }),
        expectedPlan: 'Freelancer — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'freelancer',
        expectedConcentration: 'diversified',
        description: 'Irregular multi-client income, caught off guard → daily caps',
      },
      {
        name: 'freelancer (concentrated, ≤2 sources) + tracker + meaningful remainder → Gig Structured',
        input: createInput({
          incomePattern: 'freelancer',
          spendingHabit: 'tracker',
          incomeAmount: 100000,
          fixedTotal: 30000,
          sourceCount: 1,
        }),
        expectedPlan: 'Gig — Structured',
        expectedPlanType: 'structured',
        expectedIncomePattern: 'freelancer',
        expectedConcentration: 'concentrated',
        description: 'Gig/platform-style income (1-2 sources), tracks spending, enough remaining to divide',
      },
      {
        name: 'freelancer (concentrated, ≤2 sources) + tracker + small remainder → Gig Daily Budget',
        input: createInput({
          incomePattern: 'freelancer',
          spendingHabit: 'tracker',
          incomeAmount: 50000,
          fixedTotal: 48000,
          sourceCount: 2,
        }),
        expectedPlan: 'Gig — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'freelancer',
        expectedConcentration: 'concentrated',
        description: 'Gig/platform-style income (1-2 sources), tracks spending, but remaining too small',
      },
      {
        name: 'freelancer (concentrated, ≤2 sources) + week3 → Gig Daily Budget',
        input: createInput({
          incomePattern: 'freelancer',
          spendingHabit: 'week3',
          incomeAmount: 100000,
          fixedTotal: 30000,
          sourceCount: 1,
        }),
        expectedPlan: 'Gig — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'freelancer',
        expectedConcentration: 'concentrated',
        description: 'Gig/platform-style income (1-2 sources), runs low by week 3 → daily caps',
      },
      {
        name: 'freelancer (concentrated, ≤2 sources) + off_guard → Gig Daily Budget',
        input: createInput({
          incomePattern: 'freelancer',
          spendingHabit: 'off_guard',
          incomeAmount: 100000,
          fixedTotal: 30000,
          sourceCount: 2,
        }),
        expectedPlan: 'Gig — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'freelancer',
        expectedConcentration: 'concentrated',
        description: 'Gig/platform-style income (1-2 sources), caught off guard → daily caps',
      },
    ];

    test.each(testCases)(
      '$name',
      ({ input, expectedPlan, expectedPlanType, expectedIncomePattern, expectedConcentration }) => {
        const result = assignPlan(input);
        expectPlan(result, expectedPlan, expectedPlanType, expectedIncomePattern, expectedConcentration);
      },
    );

    it('every input combination maps to exactly one plan (exhaustive coverage)', () => {
      const incomePatterns: IncomePattern[] = ['salaried', 'freelancer', 'mix'];
      const spendingHabits: SpendingHabit[] = ['tracker', 'week3', 'off_guard'];
      const incomeAmounts = [100000, 50000];
      const fixedTotals = [30000, 48000];
      // Cover both sides of the concentration threshold for the freelancer
      // branch — salaried/mix ignore sourceCount entirely, so this doesn't
      // multiply their combinations, just freelancer's.
      const sourceCounts = [1, 4];

      const plans = new Set<string>();

      for (const incomePattern of incomePatterns) {
        for (const spendingHabit of spendingHabits) {
          for (const incomeAmount of incomeAmounts) {
            for (const fixedTotal of fixedTotals) {
              if (fixedTotal >= incomeAmount) continue;
              for (const sourceCount of sourceCounts) {
                const input = createInput({ incomePattern, spendingHabit, incomeAmount, fixedTotal, sourceCount });
                const result = assignPlan(input);
                const key = `${result.plan}|${result.planType}|${result.incomePattern}`;
                plans.add(key);
              }
            }
          }
        }
      }

      // 8 now, not 6: the mix→salaried persona split (audit_team.md item 2)
      // adds 'Salaried + Side Income — Structured/Daily Budget' as distinct
      // plan names from pure 'Salaried — Structured/Daily Budget', on top
      // of the existing Gig/Freelancer split within the freelancer pattern.
      expect(plans.size).toBe(8);
      expect(plans.has('Salaried — Structured|structured|salaried')).toBe(true);
      expect(plans.has('Salaried — Daily Budget|daily|salaried')).toBe(true);
      expect(plans.has('Salaried + Side Income — Structured|structured|salaried')).toBe(true);
      expect(plans.has('Salaried + Side Income — Daily Budget|daily|salaried')).toBe(true);
      expect(plans.has('Freelancer — Structured|structured|freelancer')).toBe(true);
      expect(plans.has('Freelancer — Daily Budget|daily|freelancer')).toBe(true);
      expect(plans.has('Gig — Structured|structured|freelancer')).toBe(true);
      expect(plans.has('Gig — Daily Budget|daily|freelancer')).toBe(true);
    });
  });

  describe('reasons are generated from rules that fired', () => {
    it('includes income pattern reason with rule ID', () => {
      const result = assignPlan(createInput({ incomePattern: 'salaried' }));
      const patternReason = result.reasons[0];
      expect(patternReason.rule).toBe('income_pattern_salaried');
      expect(patternReason.reason).toContain('salaried');
    });

    it('includes allocation style reason with rule ID', () => {
      const result = assignPlan(createInput({ spendingHabit: 'week3' }));
      const styleReason = result.reasons[1];
      expect(styleReason.rule).toBe('allocation_style_daily_habit_override');
      expect(styleReason.reason).toContain('week 3');
    });

    it('freelancer pattern reason mentions irregular income when diversified (3+ sources)', () => {
      const result = assignPlan(createInput({ incomePattern: 'freelancer', sourceCount: 4 }));
      const patternReason = result.reasons[0];
      expect(patternReason.rule).toBe('income_pattern_freelancer_multi_client');
      expect(patternReason.reason).toContain('irregular');
      expect(result.incomeConcentration).toBe('diversified');
    });

    it('freelancer pattern reason mentions platforms when concentrated (≤2 sources)', () => {
      const result = assignPlan(createInput({ incomePattern: 'freelancer', sourceCount: 1 }));
      const patternReason = result.reasons[0];
      expect(patternReason.rule).toBe('income_pattern_freelancer_gig');
      expect(patternReason.reason).toContain('platform');
      expect(result.incomeConcentration).toBe('concentrated');
    });

    it('mix pattern reason mentions stable base', () => {
      const result = assignPlan(createInput({ incomePattern: 'mix' }));
      const patternReason = result.reasons[0];
      expect(patternReason.rule).toBe('income_pattern_salaried_side_income');
      expect(patternReason.reason).toContain('stable base');
    });

    it('mix pattern sets hasSideIncome true; salaried/freelancer leave it undefined', () => {
      expect(assignPlan(createInput({ incomePattern: 'mix' })).hasSideIncome).toBe(true);
      expect(assignPlan(createInput({ incomePattern: 'salaried' })).hasSideIncome).toBeUndefined();
      expect(assignPlan(createInput({ incomePattern: 'freelancer', sourceCount: 4 })).hasSideIncome).toBeUndefined();
    });

    it('mix pattern produces a distinct "Salaried + Side Income" plan name from pure salaried', () => {
      const mixResult = assignPlan(createInput({ incomePattern: 'mix', spendingHabit: 'tracker', incomeAmount: 100000, fixedTotal: 30000 }));
      const salariedResult = assignPlan(createInput({ incomePattern: 'salaried', spendingHabit: 'tracker', incomeAmount: 100000, fixedTotal: 30000 }));
      expect(mixResult.plan).toBe('Salaried + Side Income — Structured');
      expect(salariedResult.plan).toBe('Salaried — Structured');
      expect(mixResult.plan).not.toBe(salariedResult.plan);
    });

    it('tracker with meaningful remainder mentions tracking and meaningful division', () => {
      const result = assignPlan(createInput({ spendingHabit: 'tracker', incomeAmount: 100000, fixedTotal: 30000 }));
      const styleReason = result.reasons[1];
      expect(styleReason.rule).toBe('allocation_style_structured_low_needs');
      expect(styleReason.reason).toMatch(/category pockets|meaningfully/i);
    });

    it('off_guard mentions guardrails', () => {
      const result = assignPlan(createInput({ spendingHabit: 'off_guard' }));
      const styleReason = result.reasons[1];
      expect(styleReason.rule).toBe('allocation_style_daily_habit_override');
      expect(styleReason.reason).toContain('guardrails');
    });

    it('high needs ratio forces daily with percent explanation', () => {
      const result = assignPlan(createInput({ spendingHabit: 'tracker', incomeAmount: 50000, fixedTotal: 40000 }));
      expect(result.planType).toBe('daily');
      expect(result.needsBand).toBe('high');
      expect(result.reasons[1].rule).toBe('allocation_style_daily_high_needs');
      expect(result.reasons[1].reason).toContain('80%');
    });

    it('mid-band spender leans daily', () => {
      const result = assignPlan(
        createInput({
          spendingHabit: 'tracker',
          moneyPersonality: 'spender',
          incomeAmount: 100000,
          fixedTotal: 50000,
        }),
      );
      expect(result.needsBand).toBe('mid');
      expect(result.planType).toBe('daily');
      expect(result.reasons[1].rule).toBe('allocation_style_daily_mid_spender');
    });
  });

  describe('income concentration (audit_team.md item 8, Batch 4)', () => {
    it('is undefined for salaried', () => {
      const result = assignPlan(createInput({ incomePattern: 'salaried', sourceCount: 1 }));
      expect(result.incomeConcentration).toBeUndefined();
    });

    it('is undefined for mix', () => {
      const result = assignPlan(createInput({ incomePattern: 'mix', sourceCount: 1 }));
      expect(result.incomeConcentration).toBeUndefined();
    });

    it(`sourceCount at the threshold (${GIG_CONCENTRATION_MAX_SOURCES}) is concentrated`, () => {
      const result = assignPlan(
        createInput({ incomePattern: 'freelancer', sourceCount: GIG_CONCENTRATION_MAX_SOURCES }),
      );
      expect(result.incomeConcentration).toBe('concentrated');
      expect(result.plan).toBe('Gig — Structured');
    });

    it('sourceCount one above the threshold is diversified', () => {
      const result = assignPlan(
        createInput({ incomePattern: 'freelancer', sourceCount: GIG_CONCENTRATION_MAX_SOURCES + 1 }),
      );
      expect(result.incomeConcentration).toBe('diversified');
      expect(result.plan).toBe('Freelancer — Structured');
    });

    it('does not change the stored incomePattern — only the plan label/reasons', () => {
      const gig = assignPlan(createInput({ incomePattern: 'freelancer', sourceCount: 1 }));
      const multiClient = assignPlan(createInput({ incomePattern: 'freelancer', sourceCount: 5 }));
      expect(gig.incomePattern).toBe('freelancer');
      expect(multiClient.incomePattern).toBe('freelancer');
    });
  });

  describe('financial calculations', () => {
    it('calculates remaining after fixed correctly', () => {
      const result = assignPlan(createInput({ incomeAmount: 100000, fixedTotal: 30000 }));
      expect(result.remainingAfterFixed).toBe(70000);
    });

    it('calculates savings target as 10% of gross income', () => {
      const result = assignPlan(createInput({ incomeAmount: 100000, fixedTotal: 30000 }));
      expect(result.savingsTarget).toBe(10000); // 10% of the 100,000 gross income, not remainingAfterFixed
    });

    it('emergency buffer answer no longer affects the savings rate (flat 10% for everyone)', () => {
      const result = assignPlan(
        createInput({ incomeAmount: 100000, fixedTotal: 30000, emergencyBuffer: 'none' }),
      );
      expect(result.savingsTarget).toBe(10000);
    });

    it('calculates spendable as remaining minus savings', () => {
      const result = assignPlan(createInput({ incomeAmount: 100000, fixedTotal: 30000 }));
      expect(result.spendableAmount).toBe(60000);
    });

    it('handles zero fixed expenses', () => {
      const result = assignPlan(createInput({ incomeAmount: 100000, fixedTotal: 0 }));
      expect(result.remainingAfterFixed).toBe(100000);
      expect(result.savingsTarget).toBe(10000);
      expect(result.spendableAmount).toBe(90000);
    });
  });

  describe('goal-driven savings (Part 4)', () => {
    it('uses the flat 10%-of-gross-income floor when no goal is captured', () => {
      const result = assignPlan(createInput({ incomeAmount: 100000, fixedTotal: 30000 }));
      expect(result.savingsTarget).toBe(10000);
      expect(result.savingsLockDays).toBe(30);
      expect(result.reasons.some((r) => r.rule.startsWith('savings_goal'))).toBe(false);
    });

    it('derives the rate from an achievable goal and skips the shortfall reason', () => {
      // 210,000 target over 12 months = 17,500/mo ÷ 70,000 remaining = 25%,
      // comfortably under the 50% cap.
      const result = assignPlan(
        createInput({
          incomeAmount: 100000,
          fixedTotal: 30000,
          savingsGoal: { goalType: 'purchase', goalAmount: 210000, goalTimeframe: '1_year' },
        }),
      );
      expect(result.savingsTarget).toBe(17500);
      expect(result.savingsLockDays).toBe(90);
      const reason = result.reasons.find((r) => r.rule === 'savings_goal_on_track');
      expect(reason).toBeDefined();
      expect(result.reasons.some((r) => r.rule === 'savings_goal_capacity_shortfall')).toBe(false);
    });

    it('caps the rate and surfaces a shortfall reason when the derived rate exceeds the sane-share cap', () => {
      // 700,000 target over 6 months = 116,666.67/mo ÷ 70,000 remaining ≈
      // 166.7%, well over the 50% cap — should cap at 35,000 (50% of
      // remaining) rather than force the full derived rate.
      const result = assignPlan(
        createInput({
          incomeAmount: 100000,
          fixedTotal: 30000,
          savingsGoal: { goalType: 'emergency_fund', goalAmount: 700000, goalTimeframe: '6_months' },
        }),
      );
      expect(result.savingsTarget).toBe(35000);
      expect(result.savingsLockDays).toBe(60);
      const reason = result.reasons.find((r) => r.rule === 'savings_goal_capacity_shortfall');
      expect(reason).toBeDefined();
      expect(reason?.goalMonthsNeeded).toBeCloseTo(20);
      expect(reason?.goalRequiredSharePercent).toBeCloseTo(166.666, 2);
      expect(result.reasons.some((r) => r.rule === 'savings_goal_on_track')).toBe(false);
    });

    it('falls back to the 10%-of-gross floor but still applies the goal-derived lock length when goalAmount is omitted', () => {
      const result = assignPlan(
        createInput({
          incomeAmount: 100000,
          fixedTotal: 30000,
          savingsGoal: { goalType: 'other', goalTimeframe: '3_months' },
        }),
      );
      expect(result.savingsTarget).toBe(10000); // flat 10% of gross, buffer/goal-amount not a factor here
      expect(result.savingsLockDays).toBe(30);
      expect(result.reasons.some((r) => r.rule.startsWith('savings_goal'))).toBe(false);
    });

    it('never drops the target below the 10%-of-gross-income floor, even for a tiny, distant goal', () => {
      // 7,000 target over 24 months = ~291.67/mo — far below what the goal
      // alone would require, so the flat 10%-of-gross floor (10,000) binds
      // instead. Note: since remainingAfterFixed <= incomeAmount, the 10%-
      // of-gross floor now always dominates the 5%-of-remaining absolute
      // floor (ABSOLUTE_SAVINGS_FLOOR_RATE), which is kept only as a
      // defensive backstop.
      const result = assignPlan(
        createInput({
          incomeAmount: 100000,
          fixedTotal: 30000,
          emergencyBuffer: '3_plus_months',
          savingsGoal: { goalType: 'other', goalAmount: 7000, goalTimeframe: '2_plus_years' },
        }),
      );
      expect(result.savingsTarget).toBe(10000);
      expect(result.savingsLockDays).toBe(90);
    });

    it('uses the free-text goalLabel in the reason text when provided', () => {
      const result = assignPlan(
        createInput({
          incomeAmount: 100000,
          fixedTotal: 30000,
          savingsGoal: {
            goalType: 'dependent_education',
            goalLabel: "Amara's school fees",
            goalAmount: 84000,
            goalTimeframe: '1_year',
          },
        }),
      );
      const reason = result.reasons.find((r) => r.rule === 'savings_goal_on_track');
      expect(reason?.reason).toContain("Amara's school fees");
    });
  });

  describe('edge cases', () => {
    it('throws when fixed equals income', () => {
      expect(() => assignPlan(createInput({ incomeAmount: 50000, fixedTotal: 50000 }))).toThrow(
        'Fixed expenses exceed income'
      );
    });

    it('throws when fixed exceeds income', () => {
      expect(() => assignPlan(createInput({ incomeAmount: 50000, fixedTotal: 60000 }))).toThrow(
        'Fixed expenses exceed income'
      );
    });

    it('returns at least 2 reasons always', () => {
      const incomePatterns: IncomePattern[] = ['salaried', 'freelancer', 'mix'];
      const spendingHabits: SpendingHabit[] = ['tracker', 'week3', 'off_guard'];

      for (const incomePattern of incomePatterns) {
        for (const spendingHabit of spendingHabits) {
          const result = assignPlan(createInput({ incomePattern, spendingHabit }));
          expect(result.reasons.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('sourceCount does not affect plan assignment for salaried (no concentration split)', () => {
      const result1 = assignPlan(createInput({ incomePattern: 'salaried', sourceCount: 1 }));
      const result2 = assignPlan(createInput({ incomePattern: 'salaried', sourceCount: 5 }));
      expect(result1.plan).toBe(result2.plan);
      expect(result1.planType).toBe(result2.planType);
      expect(result1.incomePattern).toBe(result2.incomePattern);
    });

    it('sourceCount DOES affect the plan label for freelancer (gig vs. multi-client split, Batch 4)', () => {
      const result1 = assignPlan(createInput({ incomePattern: 'freelancer', sourceCount: 1 }));
      const result2 = assignPlan(createInput({ incomePattern: 'freelancer', sourceCount: 5 }));
      expect(result1.plan).not.toBe(result2.plan);
      // The underlying stored income pattern is unaffected either way.
      expect(result1.incomePattern).toBe(result2.incomePattern);
    });
  });
});