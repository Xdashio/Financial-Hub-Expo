import { BadRequestException } from '@nestjs/common';
import { IncomeService } from './income.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { RunwayService } from '../runway/runway.service';
import type { CreateIncomeDto } from './dto';

const PLAN = { id: 'plan-1', user_id: 'user-1', type: 'structured', income_pattern: 'salaried', status: 'active', created_at: 'x', reassigned_at: null };

const POCKETS = [
  { id: 'pocket-savings', plan_id: 'plan-1', name: 'Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 1000, daily_cap: null, created_at: 'x', updated_at: 'x' },
  { id: 'pocket-food', plan_id: 'plan-1', name: 'Food & Groceries', kind: 'spendable', category: 'food', is_time_locked: false, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
];

function makeRepository(overrides: Partial<jest.Mocked<Pick<SupabaseRepository,
  'getActivePlanByUserId' | 'getPocketsByPlanId' | 'createIncomeEvent' | 'createTransactions' | 'updatePocket'
>>> = {}) {
  return {
    getActivePlanByUserId: jest.fn().mockResolvedValue(PLAN),
    getPocketsByPlanId: jest.fn().mockResolvedValue(POCKETS.map(p => ({ ...p }))),
    createIncomeEvent: jest.fn().mockImplementation((event) => ({ ...event })),
    createTransactions: jest.fn().mockResolvedValue([]),
    updatePocket: jest.fn().mockImplementation((id, updates) => ({ id, ...updates })),
    ...overrides,
  } as unknown as jest.Mocked<SupabaseRepository>;
}

// PLAN fixture above is salaried, so the default mock never needs to be
// applicable — tests that care about the freelancer/daily runway-refresh
// path override this explicitly. See docs/FREELANCER_RUNWAY.md.
function makeRunway(overrides: Partial<jest.Mocked<Pick<RunwayService, 'getRunwayForPlan'>>> = {}) {
  return {
    getRunwayForPlan: jest.fn().mockResolvedValue({ applicable: false }),
    ...overrides,
  } as unknown as jest.Mocked<RunwayService>;
}

const BASE_DTO: CreateIncomeDto = {
  amount: 4000,
  source: 'client_payment',
  label: 'Freelance gig',
  date: '2026-08-09',
  run_allocation: true,
};

describe('IncomeService.createManualIncome', () => {
  it('throws when there is no active plan', async () => {
    const repository = makeRepository({ getActivePlanByUserId: jest.fn().mockResolvedValue(null) });
    const service = new IncomeService(repository, makeRunway());

    await expect(service.createManualIncome(BASE_DTO, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the plan has no pockets', async () => {
    const repository = makeRepository({ getPocketsByPlanId: jest.fn().mockResolvedValue([]) });
    const service = new IncomeService(repository, makeRunway());

    await expect(service.createManualIncome(BASE_DTO, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates the income event regardless of run_allocation', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository, makeRunway());

    await service.createManualIncome({ ...BASE_DTO, run_allocation: false }, 'user-1');

    expect(repository.createIncomeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', amount: 4000, source: 'client_payment', run_allocation: false })
    );
  });

  it('does not touch pocket balances when run_allocation is false', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository, makeRunway());

    const result = await service.createManualIncome({ ...BASE_DTO, run_allocation: false }, 'user-1');

    expect(repository.updatePocket).not.toHaveBeenCalled();
    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(result.allocation.triggered).toBe(false);
  });

  it('splits income across pockets by their proportional share (C5 fix)', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository, makeRunway());

    // Pre-existing total monthly_allocation across pockets is 4000
    // (1000 savings + 3000 food), so a 4000 income event should split
    // 25% / 75% between them. Balances are ledger-derived (see
    // supabase.repository.ts getPocketSummary), so the fix is writing
    // 'allocation' transactions — monthly_allocation itself is never
    // mutated after onboarding.
    const result = await service.createManualIncome(BASE_DTO, 'user-1');

    expect(repository.updatePocket).not.toHaveBeenCalled();
    expect(result.allocation.triggered).toBe(true);
    expect(result.allocation.total_allocated).toBeCloseTo(4000);
    expect(result.allocation.allocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pocket_id: 'pocket-savings', amount: 1000 }),
        expect.objectContaining({ pocket_id: 'pocket-food', amount: 3000 }),
      ])
    );
  });

  it('does not call createTransactions when no pocket has a monthly_allocation to split by', async () => {
    const repository = makeRepository({
      getPocketsByPlanId: jest.fn().mockResolvedValue(
        POCKETS.map(p => ({ ...p, monthly_allocation: 0 }))
      ),
    });
    const service = new IncomeService(repository, makeRunway());

    const result = await service.createManualIncome(BASE_DTO, 'user-1');

    // Regression guard: calling supabase-js .insert([]) with a zero-row
    // array is what produced the opaque 500 on POST /income/manual.
    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(result.allocation.triggered).toBe(true);
    expect(result.allocation.allocations).toEqual([]);
  });

  it('still creates ledger transactions for the allocation event', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository, makeRunway());

    await service.createManualIncome(BASE_DTO, 'user-1');

    expect(repository.createTransactions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ pocket_id: 'pocket-savings', type: 'allocation' }),
        expect.objectContaining({ pocket_id: 'pocket-food', type: 'allocation' }),
      ])
    );
  });

  it('returns { applicable: false } and never touches daily_cap for salaried plans', async () => {
    const repository = makeRepository();
    const runway = makeRunway();
    const service = new IncomeService(repository, runway);

    const result = await service.createManualIncome(BASE_DTO, 'user-1');

    expect(runway.getRunwayForPlan).not.toHaveBeenCalled();
    expect(repository.updatePocket).not.toHaveBeenCalled();
    expect(result.runway).toEqual({ applicable: false });
  });

  it('recomputes and persists daily_cap on every new income event for freelancer + daily plans', async () => {
    const FREELANCER_DAILY_PLAN = { ...PLAN, type: 'daily', income_pattern: 'freelancer', income_interval_days: 14 };
    const repository = makeRepository({
      getActivePlanByUserId: jest.fn().mockResolvedValue(FREELANCER_DAILY_PLAN),
    });
    const runway = makeRunway({
      getRunwayForPlan: jest.fn().mockResolvedValue({
        applicable: true,
        runwayDays: 5,
        expectedIntervalDays: 14,
        daysSinceLastIncome: 9,
        confidence: 'historical',
      }),
    });
    const service = new IncomeService(repository, runway);

    const result = await service.createManualIncome(BASE_DTO, 'user-1');

    // Recomputed against the freshly created income event, not deferred to
    // the next /pockets read — see docs/FREELANCER_RUNWAY.md.
    expect(runway.getRunwayForPlan).toHaveBeenCalledWith('user-1', FREELANCER_DAILY_PLAN);
    expect(repository.updatePocket).toHaveBeenCalledWith('pocket-food', { daily_cap: expect.any(Number) });
    // Only the spendable pocket gets a daily_cap — savings pockets are
    // never capped.
    expect(repository.updatePocket).not.toHaveBeenCalledWith('pocket-savings', expect.anything());
    expect(result.runway.applicable).toBe(true);
    expect(result.runway.runwayDays).toBe(5);
  });

  it('still recomputes runway when run_allocation is false, since the event date shifts the cadence estimate either way', async () => {
    const FREELANCER_DAILY_PLAN = { ...PLAN, type: 'daily', income_pattern: 'freelancer', income_interval_days: 14 };
    const repository = makeRepository({
      getActivePlanByUserId: jest.fn().mockResolvedValue(FREELANCER_DAILY_PLAN),
    });
    const runway = makeRunway({
      getRunwayForPlan: jest.fn().mockResolvedValue({ applicable: true, runwayDays: 8, confidence: 'estimate' }),
    });
    const service = new IncomeService(repository, runway);

    await service.createManualIncome({ ...BASE_DTO, run_allocation: false }, 'user-1');

    expect(runway.getRunwayForPlan).toHaveBeenCalled();
    expect(repository.updatePocket).toHaveBeenCalledWith('pocket-food', { daily_cap: expect.any(Number) });
  });

  // The fixture POCKETS above give savings a 25% proportional share (1000 of
  // 4000 total monthly_allocation), which is already above the 10%
  // MIN_SAVINGS_RATE floor — so every test above it exercises only the
  // proportional-split path and never the top-up branch added for the
  // "fix the savings 10% min" change. These tests use a pocket mix where
  // savings' proportional share falls under 10%, to actually cover it.
  describe('minimum savings rate enforcement', () => {
    const LOW_SAVINGS_POCKETS = [
      { id: 'pocket-savings', plan_id: 'plan-1', name: 'Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 200, daily_cap: null, created_at: 'x', updated_at: 'x' },
      { id: 'pocket-food', plan_id: 'plan-1', name: 'Food & Groceries', kind: 'spendable', category: 'food', is_time_locked: false, lock_until: null, monthly_allocation: 3800, daily_cap: null, created_at: 'x', updated_at: 'x' },
    ];

    it('tops up a savings pocket to the 10% floor when its proportional share falls short', async () => {
      // Proportional split of a 4000 income event would give savings only
      // 200 (5%), under the 400 (10%) floor. Shortfall of 200 should be
      // pulled proportionally from non-savings pockets.
      const repository = makeRepository({
        getPocketsByPlanId: jest.fn().mockResolvedValue(LOW_SAVINGS_POCKETS.map(p => ({ ...p }))),
      });
      const service = new IncomeService(repository, makeRunway());

      const result = await service.createManualIncome(BASE_DTO, 'user-1');

      expect(result.allocation.total_allocated).toBeCloseTo(4000);
      expect(result.allocation.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pocket_id: 'pocket-savings', amount: 400, is_minimum: true }),
          expect.objectContaining({ pocket_id: 'pocket-food', amount: 3600 }),
        ])
      );
      // Allocated amounts must still sum to the full income amount.
      const total = result.allocation.allocations.reduce((sum: number, a: any) => sum + a.amount, 0);
      expect(total).toBeCloseTo(4000);
    });

    it('does not touch allocations when there is no savings pocket at all', async () => {
      const NO_SAVINGS_POCKETS = [
        { id: 'pocket-food', plan_id: 'plan-1', name: 'Food & Groceries', kind: 'spendable', category: 'food', is_time_locked: false, lock_until: null, monthly_allocation: 3800, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-fun', plan_id: 'plan-1', name: 'Fun', kind: 'spendable', category: 'fun', is_time_locked: false, lock_until: null, monthly_allocation: 200, daily_cap: null, created_at: 'x', updated_at: 'x' },
      ];
      const repository = makeRepository({
        getPocketsByPlanId: jest.fn().mockResolvedValue(NO_SAVINGS_POCKETS.map(p => ({ ...p }))),
      });
      const service = new IncomeService(repository, makeRunway());

      const result = await service.createManualIncome(BASE_DTO, 'user-1');

      expect(result.allocation.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pocket_id: 'pocket-food', amount: 3800 }),
          expect.objectContaining({ pocket_id: 'pocket-fun', amount: 200 }),
        ])
      );
    });

    it('does not reduce a savings pocket that is already above the 10% floor', async () => {
      // Default POCKETS fixture: savings is 25% proportionally, well above
      // the floor, so its amount should be untouched by the top-up branch.
      const repository = makeRepository();
      const service = new IncomeService(repository, makeRunway());

      const result = await service.createManualIncome(BASE_DTO, 'user-1');

      expect(result.allocation.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pocket_id: 'pocket-savings', amount: 1000 }),
        ])
      );
    });

    it('splits the floor proportionally across multiple savings pockets', async () => {
      const MULTI_SAVINGS_POCKETS = [
        { id: 'pocket-savings-a', plan_id: 'plan-1', name: 'Emergency Fund', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 150, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-savings-b', plan_id: 'plan-1', name: 'Goal Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 50, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-food', plan_id: 'plan-1', name: 'Food & Groceries', kind: 'spendable', category: 'food', is_time_locked: false, lock_until: null, monthly_allocation: 3800, daily_cap: null, created_at: 'x', updated_at: 'x' },
      ];
      const repository = makeRepository({
        getPocketsByPlanId: jest.fn().mockResolvedValue(MULTI_SAVINGS_POCKETS.map(p => ({ ...p }))),
      });
      const service = new IncomeService(repository, makeRunway());

      const result = await service.createManualIncome(BASE_DTO, 'user-1');

      // Floor is 400 total, split 150:50 (75%/25%) between the two savings
      // pockets, same ratio as their proportional shares.
      expect(result.allocation.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pocket_id: 'pocket-savings-a', amount: 300 }),
          expect.objectContaining({ pocket_id: 'pocket-savings-b', amount: 100 }),
        ])
      );
      const total = result.allocation.allocations.reduce((sum: number, a: any) => sum + a.amount, 0);
      expect(total).toBeCloseTo(4000);
    });
  });
});