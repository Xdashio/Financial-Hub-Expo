import { BadRequestException } from '@nestjs/common';
import { EmergencyUnlockService } from './emergency-unlock.service';
import { SpendingAnalysisService } from '../insights/spending-analysis.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { Pocket, Plan, FixedExpense } from '../../database/database.types';

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

const FREELANCER_DAILY_PLAN: Plan = {
  id: 'plan-1',
  user_id: 'user-1',
  segment: 'individual',
  type: 'daily',
  income_pattern: 'freelancer',
  income_interval_days: 30,
  expected_income_amount: null,
  status: 'active',
  money_personality: 'spender',
  reserve_balance: 20000,
  monthly_planning_day: 1,
  last_planning_cycle_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  reassigned_at: null,
};

const FIXED_EXPENSES: FixedExpense[] = [
  {
    id: 'fe-rent',
    user_id: 'user-1',
    name: 'Rent',
    amount: 15000,
    due_day: 5,
    category: 'housing',
    status: 'active',
    funded_amount: 0,
    carry_forward: false,
    funded_at: null,
    notification_day_offset: 1,
    segment: 'individual',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'fe-wifi',
    user_id: 'user-1',
    name: 'WiFi',
    amount: 2000,
    due_day: 10,
    category: 'utilities',
    status: 'active',
    funded_amount: 0,
    carry_forward: false,
    funded_at: null,
    notification_day_offset: 1,
    segment: 'individual',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

describe('EmergencyUnlockService (runway-impact model)', () => {
  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      | 'getPlanById'
      | 'getTopLevelPocketsByPlanId'
      | 'getPocketSummary'
      | 'getEmergencyUnlockThisMonth'
      | 'getFixedExpensesByUserId'
      | 'createTransactions'
      | 'createEmergencyUnlock'
      | 'updatePlan'
    >
  >;
  let spendingAnalysis: jest.Mocked<SpendingAnalysisService>;
  let service: EmergencyUnlockService;

  beforeEach(() => {
    repository = {
      getPlanById: jest.fn(),
      getTopLevelPocketsByPlanId: jest.fn(),
      getPocketSummary: jest.fn(),
      getEmergencyUnlockThisMonth: jest.fn(),
      getFixedExpensesByUserId: jest.fn(),
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
        runway_days_before: 10,
        runway_days_after: 8,
        runway_reduction_days: 2,
        created_at: '2026-08-15T00:00:00.000Z',
      }),
      updatePlan: jest.fn().mockResolvedValue({}),
    } as any;

    spendingAnalysis = {
      analyze30DaySpending: jest.fn(),
      hasSufficientHistory: jest.fn(),
      calculateDaysLasting: jest.fn(),
    } as any;

    service = new EmergencyUnlockService(repository as any, spendingAnalysis);
  });

  describe('checkEligibility', () => {
    it('returns eligible for freelancer daily plan with sufficient runway', async () => {
      repository.getPlanById.mockResolvedValue(FREELANCER_DAILY_PLAN);
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SAVINGS_POCKET, FOOD_POCKET, TRANSPORT_POCKET]);
      repository.getPocketSummary.mockResolvedValue({ 
        available: 10000, 
        allocated: 5000, 
        spent: 0, 
        transactionCount: 0, 
        reallocationCount: 0 
      });
      repository.getEmergencyUnlockThisMonth.mockResolvedValue(null);
      repository.getFixedExpensesByUserId.mockResolvedValue(FIXED_EXPENSES);
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
      expect(result.discretionary_runway).toBeDefined();
      expect(result.discretionary_runway?.total_reserve).toBe(20000);
      expect(result.discretionary_runway?.fixed_obligations).toBe(17000);
      expect(result.discretionary_runway?.discretionary_reserve).toBe(3000);
      expect(result.runway_impact_options).toBeDefined();
      expect(result.runway_impact_options?.length).toBeGreaterThan(0);
    });

    it('returns not eligible for salaried plan', async () => {
      const salariedPlan = { ...FREELANCER_DAILY_PLAN, income_pattern: 'salaried' as const };
      repository.getPlanById.mockResolvedValue(salariedPlan);

      const result = await service.checkEligibility('user-1', 'plan-1');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('not_freelancer_plan');
    });

    it('returns not eligible for structured plan', async () => {
      const structuredPlan = { ...FREELANCER_DAILY_PLAN, type: 'structured' as const };
      repository.getPlanById.mockResolvedValue(structuredPlan);

      const result = await service.checkEligibility('user-1', 'plan-1');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('not_freelancer_plan');
    });

    it('returns not eligible when monthly limit reached', async () => {
      repository.getPlanById.mockResolvedValue(FREELANCER_DAILY_PLAN);
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SAVINGS_POCKET, FOOD_POCKET]);
      repository.getPocketSummary.mockResolvedValue({ 
        available: 10000, 
        allocated: 5000, 
        spent: 0, 
        transactionCount: 0, 
        reallocationCount: 0 
      });
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
    });

    it('returns not eligible when insufficient history', async () => {
      repository.getPlanById.mockResolvedValue(FREELANCER_DAILY_PLAN);
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SAVINGS_POCKET, FOOD_POCKET]);
      repository.getPocketSummary.mockResolvedValue({ 
        available: 10000, 
        allocated: 5000, 
        spent: 0, 
        transactionCount: 0, 
        reallocationCount: 0 
      });
      repository.getEmergencyUnlockThisMonth.mockResolvedValue(null);
      repository.getFixedExpensesByUserId.mockResolvedValue(FIXED_EXPENSES);
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
    });

    it('returns not eligible when discretionary runway too low', async () => {
      const lowReservePlan = { ...FREELANCER_DAILY_PLAN, reserve_balance: 1000 };
      repository.getPlanById.mockResolvedValue(lowReservePlan);
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SAVINGS_POCKET, FOOD_POCKET]);
      repository.getPocketSummary.mockResolvedValue({ 
        available: 500, 
        allocated: 5000, 
        spent: 0, 
        transactionCount: 0, 
        reallocationCount: 0 
      });
      repository.getEmergencyUnlockThisMonth.mockResolvedValue(null);
      repository.getFixedExpensesByUserId.mockResolvedValue(FIXED_EXPENSES);
      spendingAnalysis.analyze30DaySpending.mockResolvedValue({
        least_daily_spend: 500,
        most_daily_spend: 2000,
        average_daily_spend: 800,
        days_of_history: 30,
        daily_spend_by_date: new Map(),
      });
      spendingAnalysis.hasSufficientHistory.mockReturnValue(true);

      const result = await service.checkEligibility('user-1', 'plan-1');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('no_discretionary_runway');
    });
  });

  describe('executeUnlock', () => {
    beforeEach(() => {
      repository.getPlanById.mockResolvedValue(FREELANCER_DAILY_PLAN);
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SAVINGS_POCKET, FOOD_POCKET, TRANSPORT_POCKET]);
      repository.getPocketSummary.mockResolvedValue({ 
        available: 10000, 
        allocated: 5000, 
        spent: 0, 
        transactionCount: 0, 
        reallocationCount: 0 
      });
      repository.getEmergencyUnlockThisMonth.mockResolvedValue(null);
      repository.getFixedExpensesByUserId.mockResolvedValue(FIXED_EXPENSES);
      spendingAnalysis.analyze30DaySpending.mockResolvedValue({
        least_daily_spend: 500,
        most_daily_spend: 2000,
        average_daily_spend: 800,
        days_of_history: 30,
        daily_spend_by_date: new Map(),
      });
      spendingAnalysis.hasSufficientHistory.mockReturnValue(true);
    });

    it('executes unlock successfully with valid amount', async () => {
      const result = await service.executeUnlock('user-1', 'plan-1', {
        amount: 1500,
        confirm_impact: true,
      });

      expect(result.applied).toBe(true);
      expect(result.unlock).toBeDefined();
      expect(result.unlock?.amount).toBe(1500);
      expect(result.unlock?.runway_days_before).toBeDefined();
      expect(result.unlock?.runway_days_after).toBeDefined();
      expect(result.unlock?.runway_reduction_days).toBeDefined();
      expect(repository.createTransactions).toHaveBeenCalled();
      expect(repository.createEmergencyUnlock).toHaveBeenCalled();
      expect(repository.updatePlan).toHaveBeenCalled();
    });

    it('rejects amount exceeding 50% of discretionary reserve', async () => {
      const result = await service.executeUnlock('user-1', 'plan-1', {
        amount: 2000, // More than 50% of 3000 discretionary reserve
        confirm_impact: true,
      });

      expect(result.applied).toBe(false);
      expect(result.error).toBe('amount_exceeds_max_percentage');
    });

    it('rejects when impact not confirmed', async () => {
      const result = await service.executeUnlock('user-1', 'plan-1', {
        amount: 1000,
        confirm_impact: false,
      });

      expect(result.applied).toBe(false);
      expect(result.error).toBe('impact_not_confirmed');
    });

    it('rejects when savings insufficient', async () => {
      repository.getPocketSummary.mockResolvedValue({ 
        available: 500, // Less than requested
        allocated: 5000, 
        spent: 0, 
        transactionCount: 0, 
        reallocationCount: 0 
      });

      const result = await service.executeUnlock('user-1', 'plan-1', {
        amount: 1000,
        confirm_impact: true,
      });

      expect(result.applied).toBe(false);
      expect(result.error).toBe('savings_insufficient');
    });

    it('records runway impact in emergency unlock record', async () => {
      await service.executeUnlock('user-1', 'plan-1', {
        amount: 1000,
        confirm_impact: true,
      });

      const createCall = repository.createEmergencyUnlock.mock.calls[0][0];
      expect(createCall.runway_days_before).toBeDefined();
      expect(createCall.runway_days_after).toBeDefined();
      expect(createCall.runway_reduction_days).toBeDefined();
    });
  });
});