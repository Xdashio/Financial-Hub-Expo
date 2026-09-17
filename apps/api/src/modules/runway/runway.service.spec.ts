import { RunwayService } from './runway.service';
import type { SupabaseRepository } from '../../database/supabase.repository';

jest.mock('../../database/supabase.repository');
jest.mock('../../config/supabase.config');

describe('RunwayService.getRunwayForPlan', () => {
  let repo: jest.Mocked<
    Pick<SupabaseRepository, 'getIncomeEventsByUserId' | 'getFixedExpensesByUserId'>
  >;
  let service: RunwayService;

  const freelancerDaily = {
    type: 'daily',
    income_pattern: 'freelancer',
    income_interval_days: 21,
    reserve_balance: 12000,
    monthly_planning_day: 1,
    last_planning_cycle_at: null,
  };

  beforeEach(() => {
    repo = {
      getIncomeEventsByUserId: jest.fn().mockResolvedValue([]),
      getFixedExpensesByUserId: jest.fn().mockResolvedValue([]),
    };
    service = new RunwayService(repo as unknown as SupabaseRepository);
  });

  it('returns { applicable: false } for salaried plans', async () => {
    const result = await service.getRunwayForPlan('user-1', {
      ...freelancerDaily,
      income_pattern: 'salaried',
    });
    expect(result).toEqual({ applicable: false });
    expect(repo.getIncomeEventsByUserId).not.toHaveBeenCalled();
  });

  it('returns { applicable: false } for structured (non-daily) plans', async () => {
    const result = await service.getRunwayForPlan('user-1', {
      ...freelancerDaily,
      type: 'structured',
    });
    expect(result).toEqual({ applicable: false });
  });

  it('loads individual-segment income and fixed expenses for freelancer + daily', async () => {
    repo.getIncomeEventsByUserId.mockResolvedValue([
      { date: '2026-09-10' },
      { date: '2026-08-20' },
    ] as any);
    repo.getFixedExpensesByUserId.mockResolvedValue([
      { status: 'active', amount: 3000 },
      { status: 'paused', amount: 9999 }, // ignored
      { status: 'active', amount: 2000 },
    ] as any);

    const result = await service.getRunwayForPlan('user-1', freelancerDaily);

    expect(repo.getIncomeEventsByUserId).toHaveBeenCalledWith('user-1', 'individual');
    expect(repo.getFixedExpensesByUserId).toHaveBeenCalledWith('user-1', 'individual');
    expect(result.applicable).toBe(true);
    if (result.applicable) {
      expect(result.fixedObligations).toBe(5000);
      // discretionary = 12000 - 5000 = 7000; dailyBudget = max(1, round(7000/30*100)/100) = 233.33
      expect(result.dailyBudget).toBe(233.33);
      expect(result.discretionaryReserve).toBe(7000);
      expect(result.confidence).toBe('historical');
    }
  });

  it('floors dailyBudget at 1 when discretionary reserve is zero', async () => {
    repo.getFixedExpensesByUserId.mockResolvedValue([
      { status: 'active', amount: 20000 },
    ] as any);

    const result = await service.getRunwayForPlan('user-1', {
      ...freelancerDaily,
      reserve_balance: 5000,
    });

    expect(result.applicable).toBe(true);
    if (result.applicable) {
      expect(result.dailyBudget).toBe(1);
      expect(result.discretionaryReserve).toBe(0);
      expect(result.runwayDays).toBeGreaterThanOrEqual(3);
    }
  });
});
