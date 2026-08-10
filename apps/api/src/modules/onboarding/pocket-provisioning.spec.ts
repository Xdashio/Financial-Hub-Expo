import type { OnboardingInput } from '@financial-hub/shared';
import type { PlanAssignment } from './rules-engine';
import {
  buildPocketInputs,
  hasDependentsSignal,
  nextDueDateIso,
  resolveSpendableCategories,
} from './pocket-provisioning';

const baseInput: OnboardingInput = {
  incomePattern: 'salaried',
  spendingHabit: 'tracker',
  incomeAmount: 50000,
  fixedTotal: 15000,
  sourceCount: 1,
};

const structuredAssignment: PlanAssignment = {
  plan: 'Salaried — Structured',
  planType: 'structured',
  incomePattern: 'salaried',
  reasons: [],
  remainingAfterFixed: 35000,
  savingsTarget: 3500,
  spendableAmount: 31500,
  needsRatio: 0.3,
  needsBand: 'low',
};

describe('pocket-provisioning', () => {
  describe('nextDueDateIso', () => {
    it('returns this month\'s due day when it is still ahead', () => {
      const from = new Date('2026-08-10T12:00:00.000Z');
      expect(nextDueDateIso(15, from)).toBe('2026-08-15T00:00:00.000Z');
    });

    it('rolls to next month when due day has already passed', () => {
      const from = new Date('2026-08-20T12:00:00.000Z');
      expect(nextDueDateIso(15, from)).toBe('2026-09-15T00:00:00.000Z');
    });

    it('clamps day 31 into shorter months', () => {
      const from = new Date('2026-02-01T12:00:00.000Z');
      expect(nextDueDateIso(31, from)).toBe('2026-02-28T00:00:00.000Z');
    });
  });

  describe('resolveSpendableCategories / hasDependentsSignal', () => {
    it('defaults working adults to food/transport/leisure', () => {
      expect(resolveSpendableCategories(baseInput)).toEqual(['food', 'transport', 'leisure']);
    });

    it('adds family when hasDependents is true', () => {
      expect(resolveSpendableCategories({ ...baseInput, hasDependents: true })).toEqual([
        'food',
        'transport',
        'leisure',
        'family',
      ]);
    });

    it('infers dependents from education/family fixed expenses', () => {
      const input: OnboardingInput = {
        ...baseInput,
        fixedExpenses: [{ name: 'School fees', amount: 5000, dueDay: 5, category: 'education' }],
      };
      expect(hasDependentsSignal(input)).toBe(true);
      expect(resolveSpendableCategories(input)).toContain('family');
    });

    it('uses a single leisure category for students', () => {
      expect(resolveSpendableCategories({ ...baseInput, lifeStage: 'student' })).toEqual(['leisure']);
    });
  });

  describe('buildPocketInputs', () => {
    it('creates one locked fixed pocket per expense plus savings and weighted spendables', () => {
      const input: OnboardingInput = {
        ...baseInput,
        fixedExpenses: [
          { name: 'Rent', amount: 10000, dueDay: 1, category: 'housing' },
          { name: 'Internet', amount: 2000, dueDay: 10, category: 'utilities' },
        ],
        fixedTotal: 12000,
      };

      const pockets = buildPocketInputs('plan-1', structuredAssignment, input);
      const fixed = pockets.filter((p) => p.kind === 'fixed');
      expect(fixed).toHaveLength(2);
      expect(fixed.map((p) => p.name).sort()).toEqual(['Internet', 'Rent']);
      expect(fixed.every((p) => p.is_time_locked && p.lock_until)).toBe(true);
      expect(fixed.find((p) => p.name === 'Rent')!.category).toBe('housing');

      expect(pockets.some((p) => p.kind === 'savings')).toBe(true);

      const spendable = pockets.filter((p) => p.kind === 'spendable');
      expect(spendable.map((p) => p.category).sort()).toEqual(['food', 'leisure', 'transport']);
      const spendableTotal = spendable.reduce((s, p) => s + p.monthly_allocation, 0);
      expect(spendableTotal).toBeCloseTo(structuredAssignment.spendableAmount);
    });

    it('falls back to a lump Fixed Expenses pocket when only fixedTotal is set', () => {
      const pockets = buildPocketInputs('plan-1', structuredAssignment, baseInput);
      const fixed = pockets.filter((p) => p.kind === 'fixed');
      expect(fixed).toHaveLength(1);
      expect(fixed[0].name).toBe('Fixed Expenses');
      expect(fixed[0].is_time_locked).toBe(false);
      expect(fixed[0].monthly_allocation).toBe(15000);
    });

    it('creates a single Daily spend pocket for students', () => {
      const input: OnboardingInput = { ...baseInput, lifeStage: 'student', fixedTotal: 5000 };
      const pockets = buildPocketInputs('plan-1', structuredAssignment, input);
      const spendable = pockets.filter((p) => p.kind === 'spendable');
      expect(spendable).toHaveLength(1);
      expect(spendable[0].name).toBe('Daily spend');
      expect(spendable[0].monthly_allocation).toBeCloseTo(structuredAssignment.spendableAmount);
    });

    it('includes Family & obligations when dependents are signaled', () => {
      const input: OnboardingInput = { ...baseInput, hasDependents: true };
      const pockets = buildPocketInputs('plan-1', structuredAssignment, input);
      const family = pockets.find((p) => p.category === 'family');
      expect(family).toBeDefined();
      expect(family!.name).toBe('Family & obligations');
    });
  });
});
