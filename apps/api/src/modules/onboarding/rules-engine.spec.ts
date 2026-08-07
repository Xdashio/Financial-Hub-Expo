import type {
  OnboardingInput,
  IncomePattern,
  SpendingHabit,
  PlanName,
  PlanType,
} from '@financial-hub/shared';
import type { PlanAssignment } from './rules-engine';
import { assignPlan, validateOnboardingInput } from './rules-engine';

describe('Rules Engine — Plan Assignment', () => {
  const createInput = (overrides: Partial<OnboardingInput> = {}): OnboardingInput => ({
    incomePattern: 'salaried',
    spendingHabit: 'tracker',
    incomeAmount: 100000,
    fixedTotal: 30000,
    sourceCount: 1,
    ...overrides,
  });

  const expectPlan = (
    result: PlanAssignment,
    expectedPlan: PlanName,
    expectedPlanType: PlanType,
    expectedIncomePattern: IncomePattern
  ) => {
    expect(result.plan).toBe(expectedPlan);
    expect(result.planType).toBe(expectedPlanType);
    expect(result.incomePattern).toBe(expectedIncomePattern);
    expect(result.reasons).toHaveLength(2);
    expect(result.remainingAfterFixed).toBeGreaterThan(0);
    expect(result.savingsTarget).toBeGreaterThanOrEqual(0);
    expect(result.spendableAmount).toBeGreaterThanOrEqual(0);
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
        expectedPlan: 'Salaried — Structured',
        expectedPlanType: 'structured',
        expectedIncomePattern: 'salaried',
        description: 'Mix with stable base treated as salaried, tracks spending, enough remaining',
      },
      {
        name: 'mix + tracker + small remainder → Daily Budget',
        input: createInput({ incomePattern: 'mix', spendingHabit: 'tracker', incomeAmount: 50000, fixedTotal: 48000 }),
        expectedPlan: 'Salaried — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'salaried',
        description: 'Mix with stable base, tracks spending, but remaining too small',
      },
      {
        name: 'mix + week3 → Daily Budget',
        input: createInput({ incomePattern: 'mix', spendingHabit: 'week3', incomeAmount: 100000, fixedTotal: 30000 }),
        expectedPlan: 'Salaried — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'salaried',
        description: 'Mix with stable base, runs low by week 3 → daily caps',
      },
      {
        name: 'mix + off_guard → Daily Budget',
        input: createInput({ incomePattern: 'mix', spendingHabit: 'off_guard', incomeAmount: 100000, fixedTotal: 30000 }),
        expectedPlan: 'Salaried — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'salaried',
        description: 'Mix with stable base, caught off guard → daily caps',
      },
      {
        name: 'freelancer + tracker + meaningful remainder → Structured',
        input: createInput({ incomePattern: 'freelancer', spendingHabit: 'tracker', incomeAmount: 100000, fixedTotal: 30000 }),
        expectedPlan: 'Freelancer — Structured',
        expectedPlanType: 'structured',
        expectedIncomePattern: 'freelancer',
        description: 'Irregular income, tracks spending, enough remaining to divide',
      },
      {
        name: 'freelancer + tracker + small remainder → Daily Budget',
        input: createInput({ incomePattern: 'freelancer', spendingHabit: 'tracker', incomeAmount: 50000, fixedTotal: 48000 }),
        expectedPlan: 'Freelancer — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'freelancer',
        description: 'Irregular income, tracks spending, but remaining too small',
      },
      {
        name: 'freelancer + week3 → Daily Budget',
        input: createInput({ incomePattern: 'freelancer', spendingHabit: 'week3', incomeAmount: 100000, fixedTotal: 30000 }),
        expectedPlan: 'Freelancer — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'freelancer',
        description: 'Irregular income, runs low by week 3 → daily caps',
      },
      {
        name: 'freelancer + off_guard → Daily Budget',
        input: createInput({ incomePattern: 'freelancer', spendingHabit: 'off_guard', incomeAmount: 100000, fixedTotal: 30000 }),
        expectedPlan: 'Freelancer — Daily Budget',
        expectedPlanType: 'daily',
        expectedIncomePattern: 'freelancer',
        description: 'Irregular income, caught off guard → daily caps',
      },
    ];

    test.each(testCases)('$name', ({ input, expectedPlan, expectedPlanType, expectedIncomePattern }) => {
      const result = assignPlan(input);
      expectPlan(result, expectedPlan, expectedPlanType, expectedIncomePattern);
    });

    it('every input combination maps to exactly one plan (exhaustive coverage)', () => {
      const incomePatterns: IncomePattern[] = ['salaried', 'freelancer', 'mix'];
      const spendingHabits: SpendingHabit[] = ['tracker', 'week3', 'off_guard'];
      const incomeAmounts = [100000, 50000];
      const fixedTotals = [30000, 48000];

      const plans = new Set<string>();

      for (const incomePattern of incomePatterns) {
        for (const spendingHabit of spendingHabits) {
          for (const incomeAmount of incomeAmounts) {
            for (const fixedTotal of fixedTotals) {
              if (fixedTotal >= incomeAmount) continue;
              const input = createInput({ incomePattern, spendingHabit, incomeAmount, fixedTotal });
              const result = assignPlan(input);
              const key = `${result.plan}|${result.planType}|${result.incomePattern}`;
              plans.add(key);
            }
          }
        }
      }

      expect(plans.size).toBe(4);
      expect(plans.has('Salaried — Structured|structured|salaried')).toBe(true);
      expect(plans.has('Salaried — Daily Budget|daily|salaried')).toBe(true);
      expect(plans.has('Freelancer — Structured|structured|freelancer')).toBe(true);
      expect(plans.has('Freelancer — Daily Budget|daily|freelancer')).toBe(true);
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
      expect(styleReason.rule).toBe('allocation_style_daily_budget');
      expect(styleReason.reason).toContain('week 3');
    });

    it('freelancer pattern reason mentions irregular income', () => {
      const result = assignPlan(createInput({ incomePattern: 'freelancer' }));
      const patternReason = result.reasons[0];
      expect(patternReason.rule).toBe('income_pattern_freelancer');
      expect(patternReason.reason).toContain('irregular');
    });

    it('mix pattern reason mentions stable base', () => {
      const result = assignPlan(createInput({ incomePattern: 'mix' }));
      const patternReason = result.reasons[0];
      expect(patternReason.rule).toBe('income_pattern_mix_stable_base');
      expect(patternReason.reason).toContain('stable base');
    });

    it('tracker with meaningful remainder mentions tracking and meaningful division', () => {
      const result = assignPlan(createInput({ spendingHabit: 'tracker', incomeAmount: 100000, fixedTotal: 30000 }));
      const styleReason = result.reasons[1];
      expect(styleReason.rule).toBe('allocation_style_structured');
      expect(styleReason.reason).toContain('track');
      expect(styleReason.reason).toContain('meaningfully');
    });

    it('off_guard mentions guardrails', () => {
      const result = assignPlan(createInput({ spendingHabit: 'off_guard' }));
      const styleReason = result.reasons[1];
      expect(styleReason.rule).toBe('allocation_style_daily_budget');
      expect(styleReason.reason).toContain('guardrails');
    });
  });

  describe('financial calculations', () => {
    it('calculates remaining after fixed correctly', () => {
      const result = assignPlan(createInput({ incomeAmount: 100000, fixedTotal: 30000 }));
      expect(result.remainingAfterFixed).toBe(70000);
    });

    it('calculates savings target as 10% of remaining', () => {
      const result = assignPlan(createInput({ incomeAmount: 100000, fixedTotal: 30000 }));
      expect(result.savingsTarget).toBe(7000);
    });

    it('calculates spendable as remaining minus savings', () => {
      const result = assignPlan(createInput({ incomeAmount: 100000, fixedTotal: 30000 }));
      expect(result.spendableAmount).toBe(63000);
    });

    it('handles zero fixed expenses', () => {
      const result = assignPlan(createInput({ incomeAmount: 100000, fixedTotal: 0 }));
      expect(result.remainingAfterFixed).toBe(100000);
      expect(result.savingsTarget).toBe(10000);
      expect(result.spendableAmount).toBe(90000);
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

    it('returns exactly 2 reasons always', () => {
      const incomePatterns: IncomePattern[] = ['salaried', 'freelancer', 'mix'];
      const spendingHabits: SpendingHabit[] = ['tracker', 'week3', 'off_guard'];

      for (const incomePattern of incomePatterns) {
        for (const spendingHabit of spendingHabits) {
          const result = assignPlan(createInput({ incomePattern, spendingHabit }));
          expect(result.reasons).toHaveLength(2);
        }
      }
    });

    it('sourceCount does not affect plan assignment directly', () => {
      const result1 = assignPlan(createInput({ sourceCount: 1 }));
      const result2 = assignPlan(createInput({ sourceCount: 5 }));
      expect(result1.plan).toBe(result2.plan);
      expect(result1.planType).toBe(result2.planType);
      expect(result1.incomePattern).toBe(result2.incomePattern);
    });
  });
});