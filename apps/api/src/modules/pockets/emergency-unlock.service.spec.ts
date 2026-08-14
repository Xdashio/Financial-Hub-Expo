import { BadRequestException } from '@nestjs/common';
import { EmergencyUnlockService } from './emergency-unlock.service';
import { SpendingAnalysisService } from '../insights/spending-analysis.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { Pocket } from '../../database/database.types';

const SAVINGS_POCKET: Pocket = {
  id: 'pocket-savings',
  plan_id: 'plan-1',
  name: 'Savings',
  kind: 'savings',
  category: null,
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 5000,
  daily_cap: null,
  parent_pocket_id: null,
  split_percentage: null,
  repayment_schedule: null,
  loan_provider: null,
  loan_purpose: null,
  due_day: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const FOOD_POCKET: Pocket = {
  id: 'pocket-food',
  plan_id: 'plan-1',
  name: 'Food & Groceries',
  kind: 'spendable',
  category: 'food',
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 3000,
  daily_cap: null,
  parent_pocket_id: null,
  split_percentage: null,
  repayment_schedule: null,
  loan_provider: null,
  loan_purpose: null,
  due_day: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const TRANSPORT_POCKET: Pocket = {
  id: 'pocket-transport',
  plan_id: 'plan-1',
  name: 'Transport',
  kind: 'spendable',
  category: 'transport',
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 1000,
  daily_cap: null,
  parent_pocket_id: null,
  split_percentage: null,
  repayment_schedule: null,
  loan_provider: null,
  loan_purpose: null,
  due_day: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('EmergencyUnlockService', () => {
  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      | 'getTopLevelPocketsByPlanId'
      | 'getPocketSummary'
      | 'getEmergencyUnlockThisMonth'
      | 'createTransactions'
      | 'createEmergencyUnlock'
    >
  >;
  let spendingAnalysis: jest.Mocked<SpendingAnalysisService>;
  let service: EmergencyUnlockService;

  beforeEach(() => {
    repository = {
      getTopLevelPocketsByPlanId: jest.fn(),
      getPocketSummary: jest.fn(),
      getEmergencyUnlockThisMonth: jest.fn(),
      createTransactions: jest.fn().mockResolvedValue([]),
      createEmergencyUnlock: jest.fn().mockResolvedValue({
        id: 'unlock-1',
        user_id: 'user-1',
        plan_id: 'plan-1',
        amount: 1000,
        days_calculated: 2,
        least_daily_spend: 500,
        average_daily_spend: 800,
        reserve_kept: 1000,
        created_at: '2026-08-15T00:00:00.000Z',
      }),
    } as any;

    spendingAnalysis = {
      analyze30DaySpending: jest.fn(),
      hasSufficientHistory: jest.fn(),
      calculateDaysLasting: jest.fn(),
    } as any;

    service = new EmergencyUnlockService(repository as any, spendingAnalysis);
  });

  describe('checkEligibility', () => {
    it('returns eligible when all conditions are met', async () => {
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SAVINGS_POCKET, FOOD_POCKET, TRANSPORT_POCKET]);
      repository.getPocketSummary
        .mockResolvedValueOnce({ available: 0, allocated: 3000, spent: 3000, transactionCount: 10, reallocationCount: 0 })
        .mockResolvedValueOnce({ available: 0, allocated: 1000, spent: 1000, transactionCount: 5, reallocationCount: 0 })
        .mockResolvedValueOnce({ available: 10000, allocated: 5000, spent: 0, transactionCount: 0, reallocationCount: 0 });
      repository.getEmergencyUnlockThisMonth.mockResolvedValue(null);
      spendingAnalysis.analyze30DaySpending.mockResolvedValue({
        least_daily_spend: 500,
        most_daily_spend: 2000,
        average_daily_spend: 800,
        days_of_history: 30,
        daily_spend_by_date: new Map(),
      });
      spendingAnalysis.hasSufficientHistory.mockReturnValue(true);

      const result = await service.checkEligibility('user-1', 'plan-1');

      expect(result.eligible).toBe(true);
      expect(result.analysis).toEqual({
        least_daily_spend: 500,
        most_daily_spend: 2000,
        average_daily_spend: 800,
        days_of_history: 30,
      });
      expect(result.savings_reserve).toEqual({
        total_savings: 10000,
        minimum_reserve: 2000, // 20% of 10000
        available_to_unlock: 8000,
      });
    });

    it('returns not eligible when no pockets exist', async () => {
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([]);

      const result = await service.checkEligibility('user-1', 'plan-1');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('no_depleted_pockets');
    });

    it('returns not eligible when savings is depleted', async () => {
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SAVINGS_POCKET, FOOD_POCKET]);
      repository.getPocketSummary
        .mockResolvedValueOnce({ available: 0, allocated: 3000, spent: 3000, transactionCount: 10, reallocationCount: 0 })
        .mockResolvedValueOnce({ available: 0, allocated: 5000, spent: 5000, transactionCount: 0, reallocationCount: 0 });

      const result = await service.checkEligibility('user-1', 'plan-1');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('savings_depleted');
    });

    it('returns not eligible when monthly limit reached', async () => {
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SAVINGS_POCKET, FOOD_POCKET]);
      repository.getPocketSummary
        .mockResolvedValueOnce({ available: 0, allocated: 3000, spent: 3000, transactionCount: 10, reallocationCount: 0 })
        .mockResolvedValueOnce({ available: 10000, allocated: 5000, spent: 0, transactionCount: 0, reallocationCount: 0 });
      repository.getEmergencyUnlockThisMonth.mockResolvedValue({
        id: 'unlock-1',
        user_id: 'user-1',
        plan_id: 'plan-1',
        amount: 1000,
        days_calculated: 2,
        least_daily_spend: 500,
        average_daily_spend: 800,
        reserve_kept: 1000,
        created_at: '2026-08-15T00:00:00.000Z',
      });

      const result = await service.checkEligibility('user-1', 'plan-1');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('monthly_limit_reached');
      expect(result.last_used).toBe('2026-08-15T00:00:00.000Z');
    });

    it('returns not eligible when insufficient history', async () => {
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SAVINGS_POCKET, FOOD_POCKET]);
      repository.getPocketSummary
        .mockResolvedValueOnce({ available: 0, allocated: 3000, spent: 3000, transactionCount: 10, reallocationCount: 0 })
        .mockResolvedValueOnce({ available: 10000, allocated: 5000, spent: 0, transactionCount: 0, reallocationCount: 0 });
      repository.getEmergencyUnlockThisMonth.mockResolvedValue(null);
      spendingAnalysis.analyze30DaySpending.mockResolvedValue({
        least_daily_spend: 0,
        most_daily_spend: 0,
        average_daily_spend: 0,
        days_of_history: 3,
        daily_spend_by_date: new Map(),
      });
      spendingAnalysis.hasSufficientHistory.mockReturnValue(false);

      const result = await service.checkEligibility('user-1', 'plan-1');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('insufficient_history');
      expect(result.days_of_history).toBe(3);
      expect(result.minimum_required_days).toBe(7);
    });

    it('returns not eligible when not all pockets are depleted', async () => {
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SAVINGS_POCKET, FOOD_POCKET]);
      repository.getPocketSummary
        .mockResolvedValueOnce({ available: 500, allocated: 3000, spent: 2500, transactionCount: 10, reallocationCount: 0 })
        .mockResolvedValueOnce({ available: 10000, allocated: 5000, spent: 0, transactionCount: 0, reallocationCount: 0 });

      const result = await service.checkEligibility('user-1', 'plan-1');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('no_depleted_pockets');
    });
  });

  describe('executeUnlock', () => {
    beforeEach(() => {
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SAVINGS_POCKET, FOOD_POCKET, TRANSPORT_POCKET]);
      repository.getPocketSummary
        .mockResolvedValueOnce({ available: 0, allocated: 3000, spent: 3000, transactionCount: 10, reallocationCount: 0 })
        .mockResolvedValueOnce({ available: 0, allocated: 1000, spent: 1000, transactionCount: 5, reallocationCount: 0 })
        .mockResolvedValueOnce({ available: 10000, allocated: 5000, spent: 0, transactionCount: 0, reallocationCount: 0 });
      repository.getEmergencyUnlockThisMonth.mockResolvedValue(null);
      spendingAnalysis.analyze30DaySpending.mockResolvedValue({
        least_daily_spend: 500,
        most_daily_spend: 2000,
        average_daily_spend: 800,
        days_of_history: 30,
        daily_spend_by_date: new Map(),
      });
      spendingAnalysis.hasSufficientHistory.mockReturnValue(true);
      spendingAnalysis.calculateDaysLasting.mockReturnValue(2);
    });

    it('executes unlock successfully with valid amount', async () => {
      const result = await service.executeUnlock('user-1', 'plan-1', {
        amount: 600,
        confirm_reserve: true,
      });

      expect(result.applied).toBe(true);
      expect(result.unlock).toBeDefined();
      expect(result.unlock?.amount).toBe(600);
      expect(result.unlock?.days_lasting).toBe(2);
      expect(repository.createTransactions).toHaveBeenCalled();
      expect(repository.createEmergencyUnlock).toHaveBeenCalled();
    });

    it('rejects amount below minimum', async () => {
      const result = await service.executeUnlock('user-1', 'plan-1', {
        amount: 400,
        confirm_reserve: true,
      });

      expect(result.applied).toBe(false);
      expect(result.error).toBe('amount_below_minimum');
    });

    it('rejects amount above maximum', async () => {
      const result = await service.executeUnlock('user-1', 'plan-1', {
        amount: 1000,
        confirm_reserve: true,
      });

      expect(result.applied).toBe(false);
      expect(result.error).toBe('amount_above_maximum');
    });

    it('rejects when reserve not confirmed', async () => {
      const result = await service.executeUnlock('user-1', 'plan-1', {
        amount: 600,
        confirm_reserve: false,
      });

      expect(result.applied).toBe(false);
      expect(result.error).toBe('reserve_not_confirmed');
    });

    it('allocates proportionally to non-savings pockets', async () => {
      const result = await service.executeUnlock('user-1', 'plan-1', {
        amount: 600,
        confirm_reserve: true,
      });

      expect(result.applied).toBe(true);
      expect(result.unlock?.allocations).toHaveLength(2);
      // Food gets 75% (3000/4000), Transport gets 25% (1000/4000)
      expect(result.unlock?.allocations[0].amount).toBeCloseTo(450, 0); // 600 * 0.75
      expect(result.unlock?.allocations[1].amount).toBeCloseTo(150, 0); // 600 * 0.25
    });
  });
});
