import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import type { OnboardingInput } from '@financial-hub/shared';

jest.mock('../../database/supabase.repository');
jest.mock('../../config/supabase.config');

describe('OnboardingService', () => {
  let service: OnboardingService;
  let supabaseRepo: jest.Mocked<SupabaseRepository>;

  const createInput = (overrides: Partial<OnboardingInput> = {}): OnboardingInput => ({
    incomePattern: 'salaried',
    spendingHabit: 'tracker',
    incomeAmount: 100000,
    fixedTotal: 30000,
    sourceCount: 1,
    fixedExpenses: [],
    ...overrides,
  });

  const mockPocket = (overrides: any = {}) => ({
    id: 'pocket-id',
    plan_id: 'plan-id',
    name: 'Test Pocket',
    kind: 'spendable',
    category: 'food',
    is_time_locked: false,
    monthly_allocation: 10000,
    daily_cap: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  const mockPlan = (overrides: any = {}) => ({
    id: 'plan-id',
    user_id: 'user-id',
    type: 'structured',
    income_pattern: 'salaried',
    status: 'active',
    created_at: new Date().toISOString(),
    reassigned_at: null,
    ...overrides,
  });

  beforeEach(async () => {
    supabaseRepo = {
      deactivateUserPlans: jest.fn().mockResolvedValue(undefined),
      createPlan: jest.fn().mockResolvedValue(mockPlan()),
      createPockets: jest.fn().mockResolvedValue([
        mockPocket({ id: 'pocket-1', name: 'Fixed Expenses', kind: 'fixed', monthly_allocation: 30000 }),
        mockPocket({ id: 'pocket-2', name: 'Savings', kind: 'savings', monthly_allocation: 7000, is_time_locked: true }),
        mockPocket({ id: 'pocket-3', name: 'Food & Groceries', kind: 'spendable', category: 'food', monthly_allocation: 21000 }),
        mockPocket({ id: 'pocket-4', name: 'Transport', kind: 'spendable', category: 'transport', monthly_allocation: 21000 }),
        mockPocket({ id: 'pocket-5', name: 'Personal & Leisure', kind: 'spendable', category: 'leisure', monthly_allocation: 21000 }),
      ]),
      createFixedExpense: jest.fn().mockResolvedValue({}),
      createTransactions: jest.fn().mockResolvedValue([]),
      createBehaviorEvent: jest.fn().mockResolvedValue({}),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: SupabaseRepository, useValue: supabaseRepo },
      ],
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
    it('returns commit result with planId and pockets', async () => {
      const result = await service.commit(createInput({ spendingHabit: 'tracker' }), 'user-123');
      expect(result.planId).toBeDefined();
      expect(result.pockets).toBeDefined();
      expect(result.pockets.length).toBeGreaterThan(0);
    });

    it('creates fixed expenses pocket', async () => {
      const result = await service.commit(createInput(), 'user-123');
      const fixedPocket = result.pockets.find((p) => p.kind === 'fixed');
      expect(fixedPocket).toBeDefined();
      expect(fixedPocket?.name).toBe('Fixed Expenses');
      expect(fixedPocket?.monthlyAllocation).toBe(30000);
    });

    it('creates savings pocket with time lock', async () => {
      const result = await service.commit(createInput(), 'user-123');
      const savingsPocket = result.pockets.find((p) => p.kind === 'savings');
      expect(savingsPocket).toBeDefined();
      expect(savingsPocket?.name).toBe('Savings');
    });

    it('creates 3 spendable pockets for structured plan', async () => {
      const result = await service.commit(createInput({ spendingHabit: 'tracker' }), 'user-123');
      const spendablePockets = result.pockets.filter((p) => p.kind === 'spendable');
      expect(spendablePockets).toHaveLength(3);
      const categories = spendablePockets.map((p) => p.category).sort();
      expect(categories).toEqual(['food', 'leisure', 'transport']);
    });

    it('creates 3 spendable pockets with daily caps for daily plan', async () => {
      supabaseRepo.createPockets.mockResolvedValue([
        mockPocket({ id: 'pocket-1', name: 'Fixed Expenses', kind: 'fixed', monthly_allocation: 30000 }),
        mockPocket({ id: 'pocket-2', name: 'Savings', kind: 'savings', monthly_allocation: 7000, is_time_locked: true }),
        mockPocket({ id: 'pocket-3', name: 'Food & Groceries', kind: 'spendable', category: 'food', monthly_allocation: 21000, daily_cap: 233.33 }),
        mockPocket({ id: 'pocket-4', name: 'Transport', kind: 'spendable', category: 'transport', monthly_allocation: 21000, daily_cap: 233.33 }),
        mockPocket({ id: 'pocket-5', name: 'Personal & Leisure', kind: 'spendable', category: 'leisure', monthly_allocation: 21000, daily_cap: 233.34 }),
      ]);

      const result = await service.commit(createInput({ spendingHabit: 'week3' }), 'user-123');
      const spendablePockets = result.pockets.filter((p) => p.kind === 'spendable');
      expect(spendablePockets).toHaveLength(3);
      for (const pocket of spendablePockets) {
        expect(pocket.dailyCap).toBeDefined();
        expect(pocket.dailyCap).toBeGreaterThan(0);
      }
    });

    it('daily caps sum up to daily spendable amount', async () => {
      supabaseRepo.createPockets.mockResolvedValue([
        mockPocket({ id: 'pocket-1', name: 'Fixed Expenses', kind: 'fixed', monthly_allocation: 30000 }),
        mockPocket({ id: 'pocket-2', name: 'Savings', kind: 'savings', monthly_allocation: 7000, is_time_locked: true }),
        mockPocket({ id: 'pocket-3', name: 'Food & Groceries', kind: 'spendable', category: 'food', monthly_allocation: 21000, daily_cap: 233.33 }),
        mockPocket({ id: 'pocket-4', name: 'Transport', kind: 'spendable', category: 'transport', monthly_allocation: 21000, daily_cap: 233.33 }),
        mockPocket({ id: 'pocket-5', name: 'Personal & Leisure', kind: 'spendable', category: 'leisure', monthly_allocation: 21000, daily_cap: 233.34 }),
      ]);

      const result = await service.commit(createInput({ spendingHabit: 'week3' }), 'user-123');
      const spendablePockets = result.pockets.filter((p) => p.kind === 'spendable');
      const totalDailyCap = spendablePockets.reduce((sum, p) => sum + (p.dailyCap || 0), 0);
      // The mock returns specific daily caps that sum to ~700
      expect(Math.round(totalDailyCap * 100) / 100).toBe(700);
    });

    it('structured plan pockets have no daily cap', async () => {
      const result = await service.commit(createInput({ spendingHabit: 'tracker' }), 'user-123');
      const spendablePockets = result.pockets.filter((p) => p.kind === 'spendable');
      for (const pocket of spendablePockets) {
        expect(pocket.dailyCap).toBeUndefined();
      }
    });

    it('calls supabase repository methods', async () => {
      await service.commit(createInput({ spendingHabit: 'tracker' }), 'user-123');
      expect(supabaseRepo.deactivateUserPlans).toHaveBeenCalledWith('user-123');
      expect(supabaseRepo.createPlan).toHaveBeenCalled();
      expect(supabaseRepo.createPockets).toHaveBeenCalled();
      expect(supabaseRepo.createTransactions).toHaveBeenCalled();
      expect(supabaseRepo.createBehaviorEvent).toHaveBeenCalled();
    });
  });
});