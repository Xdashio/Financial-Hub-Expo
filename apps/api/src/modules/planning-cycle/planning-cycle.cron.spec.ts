import { PlanningCycleCronService } from './planning-cycle.cron';
import type { PlanningCycleService } from './planning-cycle.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { DailyAllocationService } from '../daily-allocation/daily-allocation.service';

describe('PlanningCycleCronService — daily allocation wiring', () => {
  let planningCycleService: jest.Mocked<Pick<PlanningCycleService, 'executePlanningCycle'>>;
  let repository: any;
  let dailyAllocation: jest.Mocked<Pick<DailyAllocationService, 'getDailyBudget' | 'createDailyAllocation' | 'closeDailyAllocation'>>;
  let cron: PlanningCycleCronService;

  beforeEach(() => {
    planningCycleService = {
      executePlanningCycle: jest.fn().mockResolvedValue(undefined),
    };
    repository = {
      getPlansByMonthlyPlanningDay: jest.fn().mockResolvedValue([]),
      getActiveFreelancerDailyPlans: jest.fn().mockResolvedValue([]),
      getDailyAllocationByPlanIdAndDate: jest.fn().mockResolvedValue(null),
      getOpenDailyAllocationsByDate: jest.fn().mockResolvedValue([]),
      getActualSpendForAllocation: jest.fn().mockResolvedValue(0),
    };
    dailyAllocation = {
      getDailyBudget: jest.fn().mockResolvedValue(500),
      createDailyAllocation: jest.fn().mockResolvedValue({ id: 'alloc-1' }),
      closeDailyAllocation: jest.fn().mockResolvedValue({ id: 'alloc-1', status: 'closed' }),
    };
    cron = new PlanningCycleCronService(
      planningCycleService as unknown as PlanningCycleService,
      repository as unknown as SupabaseRepository,
      dailyAllocation as unknown as DailyAllocationService,
    );
  });

  describe('runDailyAllocationCreation', () => {
    it('BUG REGRESSION (2026-08-27): actually creates a daily allocation for each active freelancer-daily plan, not just logs', async () => {
      repository.getActiveFreelancerDailyPlans.mockResolvedValue([
        { id: 'plan-1', user_id: 'user-1', reserve_balance: 15000 },
        { id: 'plan-2', user_id: 'user-2', reserve_balance: 9000 },
      ]);

      await cron.runDailyAllocationCreation();

      expect(dailyAllocation.getDailyBudget).toHaveBeenCalledWith('plan-1');
      expect(dailyAllocation.getDailyBudget).toHaveBeenCalledWith('plan-2');
      expect(dailyAllocation.createDailyAllocation).toHaveBeenCalledTimes(2);
      expect(dailyAllocation.createDailyAllocation).toHaveBeenCalledWith('user-1', 'plan-1', 500, expect.any(Date));
      expect(dailyAllocation.createDailyAllocation).toHaveBeenCalledWith('user-2', 'plan-2', 500, expect.any(Date));
    });

    it('skips plans that already have an allocation for today, without calling getDailyBudget or createDailyAllocation', async () => {
      repository.getActiveFreelancerDailyPlans.mockResolvedValue([
        { id: 'plan-1', user_id: 'user-1', reserve_balance: 15000 },
      ]);
      repository.getDailyAllocationByPlanIdAndDate.mockResolvedValue({ id: 'existing-alloc' });

      await cron.runDailyAllocationCreation();

      expect(dailyAllocation.getDailyBudget).not.toHaveBeenCalled();
      expect(dailyAllocation.createDailyAllocation).not.toHaveBeenCalled();
    });

    it('keeps processing remaining plans if one plan fails', async () => {
      repository.getActiveFreelancerDailyPlans.mockResolvedValue([
        { id: 'plan-1', user_id: 'user-1', reserve_balance: 15000 },
        { id: 'plan-2', user_id: 'user-2', reserve_balance: 9000 },
      ]);
      dailyAllocation.createDailyAllocation
        .mockRejectedValueOnce(new Error('db error'))
        .mockResolvedValueOnce({ id: 'alloc-2' } as any);

      await expect(cron.runDailyAllocationCreation()).resolves.toBeUndefined();

      expect(dailyAllocation.createDailyAllocation).toHaveBeenCalledTimes(2);
    });

    it('passes the same EAT-shifted date used for the existence check into createDailyAllocation, so the two never disagree near the UTC/EAT day boundary', async () => {
      // 2026-08-27T22:00:00Z is still 2026-08-27 in UTC but already
      // 2026-08-28 01:00 EAT (UTC+3) -- the exact boundary window where
      // passing an un-shifted Date into createDailyAllocation would make
      // it compute a different calendar day than the cron's own
      // existence-check query used.
      jest.useFakeTimers().setSystemTime(new Date('2026-08-27T22:00:00.000Z'));
      repository.getActiveFreelancerDailyPlans.mockResolvedValue([
        { id: 'plan-1', user_id: 'user-1', reserve_balance: 15000 },
      ]);

      await cron.runDailyAllocationCreation();

      expect(repository.getDailyAllocationByPlanIdAndDate).toHaveBeenCalledWith('plan-1', '2026-08-28');
      const [, , , passedDate] = dailyAllocation.createDailyAllocation.mock.calls[0];
      expect((passedDate as Date).toISOString().split('T')[0]).toBe('2026-08-28');
      jest.useRealTimers();
    });
  });

  describe('runDailyAllocationClose', () => {
    it('BUG REGRESSION (2026-08-27): actually closes each open allocation for today, not just logs', async () => {
      repository.getOpenDailyAllocationsByDate.mockResolvedValue([
        { id: 'alloc-1' },
        { id: 'alloc-2' },
      ]);
      repository.getActualSpendForAllocation.mockImplementation(async (id: string) =>
        id === 'alloc-1' ? 300 : 700,
      );

      await cron.runDailyAllocationClose();

      expect(dailyAllocation.closeDailyAllocation).toHaveBeenCalledTimes(2);
      expect(dailyAllocation.closeDailyAllocation).toHaveBeenCalledWith('alloc-1', 300);
      expect(dailyAllocation.closeDailyAllocation).toHaveBeenCalledWith('alloc-2', 700);
    });

    it('keeps processing remaining allocations if one fails to close', async () => {
      repository.getOpenDailyAllocationsByDate.mockResolvedValue([
        { id: 'alloc-1' },
        { id: 'alloc-2' },
      ]);
      dailyAllocation.closeDailyAllocation
        .mockRejectedValueOnce(new Error('db error'))
        .mockResolvedValueOnce({ id: 'alloc-2', status: 'closed' } as any);

      await expect(cron.runDailyAllocationClose()).resolves.toBeUndefined();

      expect(dailyAllocation.closeDailyAllocation).toHaveBeenCalledTimes(2);
    });

    it('does nothing when there are no open allocations for today', async () => {
      repository.getOpenDailyAllocationsByDate.mockResolvedValue([]);

      await cron.runDailyAllocationClose();

      expect(dailyAllocation.closeDailyAllocation).not.toHaveBeenCalled();
    });
  });
});
