import { BadRequestException } from '@nestjs/common';
import { SpendingAnalysisService } from './spending-analysis.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { Transaction, Pocket } from '../../database/database.types';

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

describe('SpendingAnalysisService', () => {
  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      'getTransactionsByDateRange' | 'getTopLevelPocketsByPlanId'
    >
  >;
  let service: SpendingAnalysisService;

  beforeEach(() => {
    repository = {
      getTransactionsByDateRange: jest.fn(),
      getTopLevelPocketsByPlanId: jest.fn(),
    } as any;

    service = new SpendingAnalysisService(repository as any);
  });

  describe('analyze30DaySpending', () => {
    it('calculates daily spend statistics from transactions', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn-1',
          pocket_id: 'pocket-food',
          amount: 500,
          type: 'spend',
          merchant: 'Naivas',
          category: 'grocery',
          emergency_unlock_id: null,
          daily_allocation_id: null,
          created_at: '2026-08-01T10:00:00.000Z',
        },
        {
          id: 'txn-2',
          pocket_id: 'pocket-food',
          amount: 200,
          type: 'spend',
          merchant: 'Matatu',
          category: 'transport',
          emergency_unlock_id: null,
          daily_allocation_id: null,
          created_at: '2026-08-01T15:00:00.000Z',
        },
        {
          id: 'txn-3',
          pocket_id: 'pocket-food',
          amount: 800,
          type: 'spend',
          merchant: 'Naivas',
          category: 'grocery',
          emergency_unlock_id: null,
          daily_allocation_id: null,
          created_at: '2026-08-02T10:00:00.000Z',
        },
      ];

      repository.getTransactionsByDateRange.mockResolvedValue(transactions);
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([FOOD_POCKET, SAVINGS_POCKET]);

      const result = await service.analyze30DaySpending('user-1', 'plan-1');

      expect(result.least_daily_spend).toBe(700); // 2026-08-01: 500 + 200
      expect(result.most_daily_spend).toBe(800); // 2026-08-02: 800
      expect(result.average_daily_spend).toBe(750); // (700 + 800) / 2
      expect(result.days_of_history).toBe(2);
    });

    it('excludes savings pocket transactions', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn-1',
          pocket_id: 'pocket-food',
          amount: 500,
          type: 'spend',
          merchant: 'Naivas',
          category: 'grocery',
          emergency_unlock_id: null,
          daily_allocation_id: null,
          created_at: '2026-08-01T10:00:00.000Z',
        },
        {
          id: 'txn-2',
          pocket_id: 'pocket-savings',
          amount: 1000,
          type: 'spend',
          merchant: 'Bank',
          category: 'other',
          emergency_unlock_id: null,
          daily_allocation_id: null,
          created_at: '2026-08-01T15:00:00.000Z',
        },
      ];

      repository.getTransactionsByDateRange.mockResolvedValue(transactions);
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([FOOD_POCKET, SAVINGS_POCKET]);

      const result = await service.analyze30DaySpending('user-1', 'plan-1');

      expect(result.least_daily_spend).toBe(500); // Only food pocket spend
      expect(result.most_daily_spend).toBe(500);
      expect(result.days_of_history).toBe(1);
    });

    it('excludes non-spend transactions (allocations, reallocations)', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn-1',
          pocket_id: 'pocket-food',
          amount: 500,
          type: 'spend',
          merchant: 'Naivas',
          category: 'grocery',
          emergency_unlock_id: null,
          daily_allocation_id: null,
          created_at: '2026-08-01T10:00:00.000Z',
        },
        {
          id: 'txn-2',
          pocket_id: 'pocket-food',
          amount: 1000,
          type: 'allocation',
          merchant: null,
          category: null,
          emergency_unlock_id: null,
          daily_allocation_id: null,
          created_at: '2026-08-01T15:00:00.000Z',
        },
      ];

      repository.getTransactionsByDateRange.mockResolvedValue(transactions);
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([FOOD_POCKET]);

      const result = await service.analyze30DaySpending('user-1', 'plan-1');

      expect(result.least_daily_spend).toBe(500); // Only spend transaction
      expect(result.most_daily_spend).toBe(500);
      expect(result.days_of_history).toBe(1);
    });

    it('excludes refund transactions (negative amounts)', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn-1',
          pocket_id: 'pocket-food',
          amount: 500,
          type: 'spend',
          merchant: 'Naivas',
          category: 'grocery',
          emergency_unlock_id: null,
          daily_allocation_id: null,
          created_at: '2026-08-01T10:00:00.000Z',
        },
        {
          id: 'txn-2',
          pocket_id: 'pocket-food',
          amount: -100,
          type: 'spend',
          merchant: 'Refund',
          category: 'other',
          emergency_unlock_id: null,
          daily_allocation_id: null,
          created_at: '2026-08-01T15:00:00.000Z',
        },
      ];

      repository.getTransactionsByDateRange.mockResolvedValue(transactions);
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([FOOD_POCKET]);

      const result = await service.analyze30DaySpending('user-1', 'plan-1');

      expect(result.least_daily_spend).toBe(500); // Excludes refund
      expect(result.most_daily_spend).toBe(500);
      expect(result.days_of_history).toBe(1);
    });

    it('returns zeros when no transactions', async () => {
      repository.getTransactionsByDateRange.mockResolvedValue([]);
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([FOOD_POCKET]);

      const result = await service.analyze30DaySpending('user-1', 'plan-1');

      expect(result.least_daily_spend).toBe(0);
      expect(result.most_daily_spend).toBe(0);
      expect(result.average_daily_spend).toBe(0);
      expect(result.days_of_history).toBe(0);
    });

    it('handles equal daily spends correctly', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn-1',
          pocket_id: 'pocket-food',
          amount: 500,
          type: 'spend',
          merchant: 'Naivas',
          category: 'grocery',
          emergency_unlock_id: null,
          daily_allocation_id: null,
          created_at: '2026-08-01T10:00:00.000Z',
        },
        {
          id: 'txn-2',
          pocket_id: 'pocket-food',
          amount: 500,
          type: 'spend',
          merchant: 'Naivas',
          category: 'grocery',
          emergency_unlock_id: null,
          daily_allocation_id: null,
          created_at: '2026-08-02T10:00:00.000Z',
        },
      ];

      repository.getTransactionsByDateRange.mockResolvedValue(transactions);
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([FOOD_POCKET]);

      const result = await service.analyze30DaySpending('user-1', 'plan-1');

      expect(result.least_daily_spend).toBe(500);
      expect(result.most_daily_spend).toBe(500);
      expect(result.average_daily_spend).toBe(500);
      expect(result.days_of_history).toBe(2);
    });
  });

  describe('hasSufficientHistory', () => {
    it('returns true when days >= 7', () => {
      const analysis = {
        least_daily_spend: 500,
        most_daily_spend: 2000,
        average_daily_spend: 800,
        days_of_history: 10,
        daily_spend_by_date: new Map(),
      };

      expect(service.hasSufficientHistory(analysis)).toBe(true);
    });

    it('returns false when days < 7', () => {
      const analysis = {
        least_daily_spend: 500,
        most_daily_spend: 2000,
        average_daily_spend: 800,
        days_of_history: 3,
        daily_spend_by_date: new Map(),
      };

      expect(service.hasSufficientHistory(analysis)).toBe(false);
    });

    it('returns true when days == 7', () => {
      const analysis = {
        least_daily_spend: 500,
        most_daily_spend: 2000,
        average_daily_spend: 800,
        days_of_history: 7,
        daily_spend_by_date: new Map(),
      };

      expect(service.hasSufficientHistory(analysis)).toBe(true);
    });
  });

  describe('calculateDaysLasting', () => {
    it('calculates days lasting correctly', () => {
      const days = service.calculateDaysLasting(1500, 500);
      expect(days).toBe(3); // 1500 / 500 = 3
    });

    it('throws error when least daily spend is zero', () => {
      expect(() => service.calculateDaysLasting(1000, 0)).toThrow(BadRequestException);
    });

    it('throws error when least daily spend is negative', () => {
      expect(() => service.calculateDaysLasting(1000, -100)).toThrow(BadRequestException);
    });

    it('returns 1 when amount equals least daily spend', () => {
      const days = service.calculateDaysLasting(500, 500);
      expect(days).toBe(1);
    });

    it('returns 0 when amount is less than least daily spend', () => {
      const days = service.calculateDaysLasting(400, 500);
      expect(days).toBe(0);
    });
  });
});
