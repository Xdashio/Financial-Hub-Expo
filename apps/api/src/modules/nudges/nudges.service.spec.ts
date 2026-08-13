import { NudgesService } from './nudges.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { RunwayService } from '../runway/runway.service';

const FREELANCER_DAILY_PLAN = {
  id: 'plan-1',
  user_id: 'user-1',
  type: 'daily' as const,
  income_pattern: 'freelancer' as const,
  income_interval_days: 14,
  expected_income_amount: 20000,
  status: 'active' as const,
  created_at: '2026-07-01T00:00:00.000Z',
  reassigned_at: null,
};

const SALARIED_PLAN = {
  ...FREELANCER_DAILY_PLAN,
  type: 'structured' as const,
  income_pattern: 'salaried' as const,
};

const SPENDABLE_POCKET = {
  id: 'pocket-transport',
  plan_id: 'plan-1',
  name: 'Transport',
  kind: 'spendable',
  category: 'transport',
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 6000,
  daily_cap: null,
  parent_pocket_id: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

function makeRepository(overrides: Partial<SupabaseRepository> = {}) {
  return {
    getActivePlanByUserId: jest.fn(),
    getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue([SPENDABLE_POCKET]),
    getIncomeEventsByUserId: jest.fn().mockResolvedValue([]),
    getSpendTotalsByPocketBetween: jest.fn().mockResolvedValue(new Map()),
    getPocketSummary: jest.fn().mockResolvedValue({
      allocated: 6000,
      spent: 0,
      available: 6000,
      transactionCount: 0,
      reallocationCount: 0,
    }),
    ...overrides,
  } as unknown as jest.Mocked<SupabaseRepository>;
}

describe('NudgesService.getRunwayNudges', () => {
  it('returns [] when the user has no active plan', async () => {
    const repository = makeRepository({ getActivePlanByUserId: jest.fn().mockResolvedValue(null) } as any);
    const runway = { getRunwayForPlan: jest.fn() } as unknown as jest.Mocked<RunwayService>;
    const service = new NudgesService(repository, runway);

    expect(await service.getRunwayNudges('user-1')).toEqual([]);
    expect(repository.getTopLevelPocketsByPlanId).not.toHaveBeenCalled();
  });

  it('returns [] when the plan has no spendable pockets', async () => {
    const repository = makeRepository({
      getActivePlanByUserId: jest.fn().mockResolvedValue(SALARIED_PLAN),
      getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue([{ ...SPENDABLE_POCKET, kind: 'fixed' }]),
    } as any);
    const runway = { getRunwayForPlan: jest.fn() } as unknown as jest.Mocked<RunwayService>;
    const service = new NudgesService(repository, runway);

    expect(await service.getRunwayNudges('user-1')).toEqual([]);
  });

  it('freelancer + daily plan: uses RunwayService for the horizon and last income date for the period start', async () => {
    const repository = makeRepository({
      getActivePlanByUserId: jest.fn().mockResolvedValue(FREELANCER_DAILY_PLAN),
      getIncomeEventsByUserId: jest.fn().mockResolvedValue([
        { id: 'evt-1', user_id: 'user-1', amount: 20000, source: 'client', label: null, date: daysAgoIso(4), run_allocation: true, unallocated_surplus: null, surplus_allocation_status: null, created_at: daysAgoIso(4) },
      ]),
      getSpendTotalsByPocketBetween: jest.fn().mockResolvedValue(new Map([[SPENDABLE_POCKET.id, 3000]])),
      getPocketSummary: jest.fn().mockResolvedValue({
        allocated: 6000,
        spent: 3000,
        available: 3000,
        transactionCount: 5,
        reallocationCount: 0,
      }),
    } as any);
    const runway = {
      getRunwayForPlan: jest.fn().mockResolvedValue({
        applicable: true,
        runwayDays: 10, // comfortably more than the ~4-5 day projected depletion below -> should nudge
        expectedIntervalDays: 14,
        daysSinceLastIncome: 4,
        confidence: 'historical',
      }),
    } as unknown as jest.Mocked<RunwayService>;

    const service = new NudgesService(repository, runway);
    const nudges = await service.getRunwayNudges('user-1');

    expect(runway.getRunwayForPlan).toHaveBeenCalledWith('user-1', FREELANCER_DAILY_PLAN);
    // 3000 spent over ~4-5 elapsed days ≈ 600-750/day velocity against 3000
    // available -> projects to deplete in ~4-5 days, well short of the
    // mocked 10-day runway horizon, so a nudge should fire.
    expect(nudges).toHaveLength(1);
    expect(nudges[0].type).toBe('runway_low');
    expect(nudges[0].pocketId).toBe(SPENDABLE_POCKET.id);
    expect(nudges[0].horizonSource).toBe('freelancer_runway');
    expect(nudges[0].horizonDays).toBe(10);
  });

  it('freelancer + daily plan: returns [] when runway is not applicable', async () => {
    const repository = makeRepository({
      getActivePlanByUserId: jest.fn().mockResolvedValue(FREELANCER_DAILY_PLAN),
    } as any);
    const runway = {
      getRunwayForPlan: jest.fn().mockResolvedValue({ applicable: false }),
    } as unknown as jest.Mocked<RunwayService>;

    const service = new NudgesService(repository, runway);
    expect(await service.getRunwayNudges('user-1')).toEqual([]);
  });

  it('salaried/structured plan: falls back to calendar-month horizon, never calling RunwayService', async () => {
    const repository = makeRepository({
      getActivePlanByUserId: jest.fn().mockResolvedValue(SALARIED_PLAN),
      getSpendTotalsByPocketBetween: jest.fn().mockResolvedValue(new Map([[SPENDABLE_POCKET.id, 100]])),
      getPocketSummary: jest.fn().mockResolvedValue({
        allocated: 6000,
        spent: 100,
        available: 5900,
        transactionCount: 1,
        reallocationCount: 0,
      }),
    } as any);
    const runway = { getRunwayForPlan: jest.fn() } as unknown as jest.Mocked<RunwayService>;

    const service = new NudgesService(repository, runway);
    const nudges = await service.getRunwayNudges('user-1');

    expect(runway.getRunwayForPlan).not.toHaveBeenCalled();
    // Low, steady spend well within a comfortable balance -> no nudge.
    expect(nudges).toEqual([]);
  });
});

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}