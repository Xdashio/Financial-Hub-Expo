import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import type { OnboardingInput } from '@financial-hub/shared';

describe('OnboardingService', () => {
  let service: OnboardingService;

  const createInput = (overrides: Partial<OnboardingInput> = {}): OnboardingInput => ({
    incomePattern: 'salaried',
    spendingHabit: 'tracker',
    incomeAmount: 100000,
    fixedTotal: 30000,
    sourceCount: 1,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnboardingService],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assign', () => {
    it('returns assign result for salaried structured', () => {
      const result = service.assign(createInput({ spendingHabit: 'tracker' }));
      expect(result.plan).toBe('Salaried — Structured');
      expect(result.planType).toBe('structured');
      expect(result.incomePattern).toBe('salaried');
      expect(result.reasons).toHaveLength(2);
      expect(result.remainingAfterFixed).toBe(70000);
      expect(result.savingsTarget).toBe(7000);
      expect(result.spendableAmount).toBe(63000);
    });

    it('returns assign result for salaried daily budget', () => {
      const result = service.assign(createInput({ spendingHabit: 'week3' }));
      expect(result.plan).toBe('Salaried — Daily Budget');
      expect(result.planType).toBe('daily');
      expect(result.incomePattern).toBe('salaried');
    });

    it('returns assign result for freelancer structured', () => {
      const result = service.assign(createInput({ incomePattern: 'freelancer', spendingHabit: 'tracker' }));
      expect(result.plan).toBe('Freelancer — Structured');
      expect(result.planType).toBe('structured');
      expect(result.incomePattern).toBe('freelancer');
    });

    it('returns assign result for freelancer daily budget', () => {
      const result = service.assign(createInput({ incomePattern: 'freelancer', spendingHabit: 'off_guard' }));
      expect(result.plan).toBe('Freelancer — Daily Budget');
      expect(result.planType).toBe('daily');
      expect(result.incomePattern).toBe('freelancer');
    });

    it('throws on invalid input', () => {
      expect(() => service.assign(createInput({ incomeAmount: 0 }))).toThrow('Income amount must be positive');
    });

    it('throws when fixed exceeds income', () => {
      expect(() => service.assign(createInput({ fixedTotal: 100000 }))).toThrow(
        'Fixed expenses cannot exceed or equal income'
      );
    });
  });

  describe('commit', () => {
    it('returns commit result with planId and pockets', () => {
      const result = service.commit(createInput({ spendingHabit: 'tracker' }), 'user-123');
      expect(result.planId).toBeDefined();
      expect(result.pockets).toBeDefined();
      expect(result.pockets.length).toBeGreaterThan(0);
    });

    it('creates fixed expenses pocket', () => {
      const result = service.commit(createInput(), 'user-123');
      const fixedPocket = result.pockets.find((p) => p.kind === 'fixed');
      expect(fixedPocket).toBeDefined();
      expect(fixedPocket?.name).toBe('Fixed Expenses');
      expect(fixedPocket?.monthlyAllocation).toBe(30000);
    });

    it('creates savings pocket with time lock', () => {
      const result = service.commit(createInput(), 'user-123');
      const savingsPocket = result.pockets.find((p) => p.kind === 'savings');
      expect(savingsPocket).toBeDefined();
      expect(savingsPocket?.name).toBe('Savings');
    });

    it('creates 3 spendable pockets for structured plan', () => {
      const result = service.commit(createInput({ spendingHabit: 'tracker' }), 'user-123');
      const spendablePockets = result.pockets.filter((p) => p.kind === 'spendable');
      expect(spendablePockets).toHaveLength(3);
      const categories = spendablePockets.map((p) => p.category).sort();
      expect(categories).toEqual(['food', 'leisure', 'transport']);
    });

    it('creates 3 spendable pockets with daily caps for daily plan', () => {
      const result = service.commit(createInput({ spendingHabit: 'week3' }), 'user-123');
      const spendablePockets = result.pockets.filter((p) => p.kind === 'spendable');
      expect(spendablePockets).toHaveLength(3);
      for (const pocket of spendablePockets) {
        expect(pocket.dailyCap).toBeDefined();
        expect(pocket.dailyCap).toBeGreaterThan(0);
      }
    });

    it('daily caps sum up to daily spendable amount', () => {
      const result = service.commit(createInput({ spendingHabit: 'week3' }), 'user-123');
      const spendablePockets = result.pockets.filter((p) => p.kind === 'spendable');
      const totalDailyCap = spendablePockets.reduce((sum, p) => sum + (p.dailyCap || 0), 0);
      const dailySpendable = 63000 / 30; // total daily spendable across all pockets
      expect(Math.round(totalDailyCap * 100) / 100).toBe(Math.round(dailySpendable * 100) / 100);
    });

    it('structured plan pockets have no daily cap', () => {
      const result = service.commit(createInput({ spendingHabit: 'tracker' }), 'user-123');
      const spendablePockets = result.pockets.filter((p) => p.kind === 'spendable');
      for (const pocket of spendablePockets) {
        expect(pocket.dailyCap).toBeUndefined();
      }
    });
  });
});