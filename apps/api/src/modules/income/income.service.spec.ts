import { BadRequestException } from '@nestjs/common';
import { IncomeService } from './income.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { RunwayService } from '../runway/runway.service';
import type { PushDeliveryService } from '../notifications/push-delivery.service';
import type { CreateIncomeDto } from './dto';

const PLAN = { id: 'plan-1', user_id: 'user-1', type: 'structured', income_pattern: 'salaried', status: 'active', created_at: 'x', reassigned_at: null, expected_income_amount: null };

const POCKETS = [
  { id: 'pocket-savings', plan_id: 'plan-1', name: 'Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 1000, daily_cap: null, created_at: 'x', updated_at: 'x' },
  { id: 'pocket-food', plan_id: 'plan-1', name: 'Food & Groceries', kind: 'spendable', category: 'food', is_time_locked: false, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
];

function makeRepository(overrides: Partial<jest.Mocked<Pick<SupabaseRepository,
  'getActivePlanByUserId' | 'getTopLevelPocketsByPlanId' | 'createIncomeEvent' | 'createTransactions' | 'updatePocket' | 'getIdempotencyRecord' | 'saveIdempotencyRecord' | 'getSubPocketsByParentId' | 'allocatePendingSurplusAtomic'
>>> = {}) {
  return {
    getActivePlanByUserId: jest.fn().mockResolvedValue(PLAN),
    getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(POCKETS.map(p => ({ ...p }))),
    createIncomeEvent: jest.fn().mockImplementation((event) => ({ ...event })),
    createTransactions: jest.fn().mockResolvedValue([]),
    getIdempotencyRecord: jest.fn().mockResolvedValue(null),
    saveIdempotencyRecord: jest.fn().mockResolvedValue({ id: 'idem-1' }),
    updatePocket: jest.fn().mockImplementation((id, updates) => ({ id, ...updates })),
    getSubPocketsByParentId: jest.fn().mockResolvedValue([]),
    allocatePendingSurplusAtomic: jest.fn().mockResolvedValue({ new_pocket: { id: 'new-pocket', name: 'New pocket' } }),
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

function makePush(overrides: Partial<jest.Mocked<Pick<PushDeliveryService, 'notifyAllocationReceived'>>> = {}) {
  return {
    notifyAllocationReceived: jest.fn().mockResolvedValue({ sent: false }),
    ...overrides,
  } as unknown as jest.Mocked<PushDeliveryService>;
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
    const service = new IncomeService(repository, makeRunway(), makePush());

    await expect(service.createManualIncome(BASE_DTO, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the plan has no pockets', async () => {
    const repository = makeRepository({ getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue([]) });
    const service = new IncomeService(repository, makeRunway(), makePush());

    await expect(service.createManualIncome(BASE_DTO, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates the income event regardless of run_allocation', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository, makeRunway(), makePush());

    await service.createManualIncome({ ...BASE_DTO, run_allocation: false }, 'user-1');

    expect(repository.createIncomeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', amount: 4000, source: 'client_payment', run_allocation: false })
    );
  });

  it('does not touch pocket balances when run_allocation is false', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository, makeRunway(), makePush());

    const result = await service.createManualIncome({ ...BASE_DTO, run_allocation: false }, 'user-1');

    expect(repository.updatePocket).not.toHaveBeenCalled();
    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(result.allocation.triggered).toBe(false);
  });

  it('splits income across pockets by their proportional share (C5 fix)', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository, makeRunway(), makePush());

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
      getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(
        POCKETS.map(p => ({ ...p, monthly_allocation: 0 }))
      ),
    });
    const service = new IncomeService(repository, makeRunway(), makePush());

    const result = await service.createManualIncome(BASE_DTO, 'user-1');

    // Regression guard: calling supabase-js .insert([]) with a zero-row
    // array is what produced the opaque 500 on POST /income/manual.
    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(result.allocation.triggered).toBe(true);
    expect(result.allocation.allocations).toEqual([]);
  });

  it('still creates ledger transactions for the allocation event', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository, makeRunway(), makePush());

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
    const service = new IncomeService(repository, runway, makePush());

    const result = await service.createManualIncome(BASE_DTO, 'user-1');

    expect(runway.getRunwayForPlan).not.toHaveBeenCalled();
    expect(repository.updatePocket).not.toHaveBeenCalled();
    expect(result.runway).toEqual({ applicable: false });
  });

  it('still records income when the idempotency table lookup throws (does not 500)', async () => {
    const repository = makeRepository({
      getIdempotencyRecord: jest.fn().mockRejectedValue(new Error('relation "idempotency_records" does not exist')),
    });
    const service = new IncomeService(repository, makeRunway(), makePush());

    const result = await service.createManualIncome(
      { ...BASE_DTO, idempotency_key: 'income_12345678' },
      'user-1',
    );

    expect(result.allocation.triggered).toBe(true);
    expect(repository.createIncomeEvent).toHaveBeenCalled();
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
    const service = new IncomeService(repository, runway, makePush());

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
    const service = new IncomeService(repository, runway, makePush());

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
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(LOW_SAVINGS_POCKETS.map(p => ({ ...p }))),
      });
      const service = new IncomeService(repository, makeRunway(), makePush());

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
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(NO_SAVINGS_POCKETS.map(p => ({ ...p }))),
      });
      const service = new IncomeService(repository, makeRunway(), makePush());

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
      const service = new IncomeService(repository, makeRunway(), makePush());

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
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(MULTI_SAVINGS_POCKETS.map(p => ({ ...p }))),
      });
      const service = new IncomeService(repository, makeRunway(), makePush());

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

  describe('sub-pocket percentage allocation (Phase 1)', () => {
    // Use just the food pocket to test sub-pocket allocation in isolation
    const PARENT_WITH_SUBS = [
      { 
        ...POCKETS[1], // Food pocket
        id: 'pocket-food', 
        monthly_allocation: 4000, 
        split_percentage: null,
        parent_pocket_id: null,
        name: 'Food & Groceries'
      },
    ];
    const SUB_POCKETS = [
      { 
        ...POCKETS[1], 
        id: 'sub-snacks', 
        parent_pocket_id: 'pocket-food', 
        monthly_allocation: 600, 
        split_percentage: 20,
        plan_id: 'plan-1',
        name: 'Snacks',
        kind: 'spendable',
        category: 'food',
        is_time_locked: false,
        lock_until: null,
        daily_cap: null,
        created_at: 'x',
        updated_at: 'x'
      },
      { 
        ...POCKETS[1], 
        id: 'sub-dining', 
        parent_pocket_id: 'pocket-food', 
        monthly_allocation: 1200, 
        split_percentage: 40,
        plan_id: 'plan-1',
        name: 'Dining Out',
        kind: 'spendable',
        category: 'food',
        is_time_locked: false,
        lock_until: null,
        daily_cap: null,
        created_at: 'x',
        updated_at: 'x'
      },
    ];

    it('splits parent share among sub-pockets by their percentages', async () => {
      const repository = makeRepository({
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(PARENT_WITH_SUBS),
        getSubPocketsByParentId: jest.fn().mockResolvedValue(SUB_POCKETS),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      const result = await service.createManualIncome(BASE_DTO, 'user-1');

      // Food parent gets 100% of 4000 = 4000
      // Sub-snacks gets 20% of 4000 = 800
      // Sub-dining gets 40% of 4000 = 1600
      // Food keeps remaining 40% = 1600 as reserved
      expect(result.allocation.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pocket_id: 'sub-snacks', amount: 800 }),
          expect.objectContaining({ pocket_id: 'sub-dining', amount: 1600 }),
          expect.objectContaining({ pocket_id: 'pocket-food', amount: 1600 }), // reserved remainder
        ])
      );
    });

    it('leaves unallocated percentage with parent as reserved', async () => {
      const repository = makeRepository({
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(PARENT_WITH_SUBS),
        getSubPocketsByParentId: jest.fn().mockResolvedValue(SUB_POCKETS),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      const result = await service.createManualIncome(BASE_DTO, 'user-1');

      // 20% + 40% = 60% allocated to subs, 40% stays with parent as reserved
      const parentAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-food');
      expect(parentAllocation?.amount).toBe(1600); // reserved portion only
      // Total distributed to subs is 800 + 1600 = 2400
      const subTotal = result.allocation.allocations
        .filter(a => a.pocket_id === 'sub-snacks' || a.pocket_id === 'sub-dining')
        .reduce((sum, a) => sum + a.amount, 0);
      expect(subTotal).toBe(2400);
    });

    it('applies per-event sub_split_overrides when provided', async () => {
      const repository = makeRepository({
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(PARENT_WITH_SUBS),
        getSubPocketsByParentId: jest.fn().mockResolvedValue(SUB_POCKETS),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      const result = await service.createManualIncome(
        { 
          ...BASE_DTO, 
          sub_split_overrides: {
            'pocket-food': [{ pocketId: 'sub-snacks', amount: 800 }]
          }
        }, 
        'user-1'
      );

      // Override should give sub-snacks 800, remainder stays with parent
      expect(result.allocation.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pocket_id: 'sub-snacks', amount: 800 }),
          expect.objectContaining({ pocket_id: 'pocket-food', amount: 3200 }), // 4000 - 800
        ])
      );
    });

    it('filters out override targets that do not belong to the specified parent', async () => {
      const repository = makeRepository({
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(PARENT_WITH_SUBS),
        getSubPocketsByParentId: jest.fn().mockResolvedValue(SUB_POCKETS),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      // Try to override a pocket that doesn't belong to the parent
      const result = await service.createManualIncome(
        { 
          ...BASE_DTO, 
          sub_split_overrides: {
            'pocket-food': [{ pocketId: 'pocket-savings', amount: 500 }]
          }
        }, 
        'user-1'
      );

      // Invalid override is filtered out, food gets full share
      expect(result.allocation.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pocket_id: 'pocket-food', amount: 4000 }),
        ])
      );
      // pocket-savings should not appear as a sub-pocket of food
      const foodSubAllocations = result.allocation.allocations.filter(a => a.pocket_id === 'sub-snacks' || a.pocket_id === 'sub-dining');
      expect(foodSubAllocations.length).toBe(0);
    });

    it('scales sub-pocket allocation with the actual income event amount', async () => {
      const repository = makeRepository({
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(PARENT_WITH_SUBS),
        getSubPocketsByParentId: jest.fn().mockResolvedValue(SUB_POCKETS),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      // Smaller income event should proportionally scale sub allocations
      const result = await service.createManualIncome({ ...BASE_DTO, amount: 2000 }, 'user-1');

      // Food parent gets 100% of 2000 = 2000
      // Sub-snacks gets 20% of 2000 = 400
      // Sub-dining gets 40% of 2000 = 800
      // Food keeps remaining 40% = 800 as reserved
      expect(result.allocation.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pocket_id: 'sub-snacks', amount: 400 }),
          expect.objectContaining({ pocket_id: 'sub-dining', amount: 800 }),
          expect.objectContaining({ pocket_id: 'pocket-food', amount: 800 }), // reserved
        ])
      );
    });

    it('keeps full amount with parent when all sub-pockets have null split_percentage', async () => {
      // Regression: before the shared helper, split_percentage || 0 treated null
      // and 0 identically. The deeper bug was that allocateSurplus never called
      // applySubPocketSplits at all. This test guards the null path of the helper.
      const NULL_SUBS = [
        { ...SUB_POCKETS[0], split_percentage: null },
        { ...SUB_POCKETS[1], split_percentage: null },
      ];
      const repository = makeRepository({
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(PARENT_WITH_SUBS),
        getSubPocketsByParentId: jest.fn().mockResolvedValue(NULL_SUBS),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      const result = await service.createManualIncome(BASE_DTO, 'user-1');

      // Full amount stays with parent; neither sub receives anything
      expect(result.allocation.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pocket_id: 'pocket-food', amount: 4000 }),
        ])
      );
      expect(result.allocation.allocations.find(a => a.pocket_id === 'sub-snacks')).toBeUndefined();
      expect(result.allocation.allocations.find(a => a.pocket_id === 'sub-dining')).toBeUndefined();
    });

    it('keeps full amount with parent when all sub-pockets have zero split_percentage', async () => {
      const ZERO_SUBS = [
        { ...SUB_POCKETS[0], split_percentage: 0 },
        { ...SUB_POCKETS[1], split_percentage: 0 },
      ];
      const repository = makeRepository({
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(PARENT_WITH_SUBS),
        getSubPocketsByParentId: jest.fn().mockResolvedValue(ZERO_SUBS),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      const result = await service.createManualIncome(BASE_DTO, 'user-1');

      expect(result.allocation.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pocket_id: 'pocket-food', amount: 4000 }),
        ])
      );
      expect(result.allocation.allocations.find(a => a.pocket_id === 'sub-snacks')).toBeUndefined();
      expect(result.allocation.allocations.find(a => a.pocket_id === 'sub-dining')).toBeUndefined();
    });

    it('only distributes to sub-pockets with a positive split_percentage (mixed)', async () => {
      // One sub has a real percentage, one has null — only the positive one gets money
      const MIXED_SUBS = [
        { ...SUB_POCKETS[0], split_percentage: 30 }, // sub-snacks: 30%
        { ...SUB_POCKETS[1], split_percentage: null }, // sub-dining: opted out
      ];
      const repository = makeRepository({
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(PARENT_WITH_SUBS),
        getSubPocketsByParentId: jest.fn().mockResolvedValue(MIXED_SUBS),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      const result = await service.createManualIncome(BASE_DTO, 'user-1');

      // sub-snacks: 30% of 4000 = 1200; pocket-food reserved: 70% = 2800
      expect(result.allocation.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pocket_id: 'sub-snacks', amount: 1200 }),
          expect.objectContaining({ pocket_id: 'pocket-food', amount: 2800 }),
        ])
      );
      expect(result.allocation.allocations.find(a => a.pocket_id === 'sub-dining')).toBeUndefined();
    });
  });

  describe('fixed pocket capping', () => {
    it('caps fixed pockets at their monthly_allocation and redistributes excess', async () => {
      const POCKETS_WITH_FIXED = [
        { id: 'pocket-savings', plan_id: 'plan-1', name: 'Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 1000, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-rent', plan_id: 'plan-1', name: 'Rent', kind: 'fixed', category: 'housing', is_time_locked: true, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-food', plan_id: 'plan-1', name: 'Food & Groceries', kind: 'spendable', category: 'food', is_time_locked: false, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
      ];
      // Set expected_income_amount high enough that surplus doesn't trigger
      const PLAN_WITH_HIGH_EXPECTED = { 
        ...PLAN, 
        expected_income_amount: 20000 
      };
      const repository = makeRepository({
        getActivePlanByUserId: jest.fn().mockResolvedValue(PLAN_WITH_HIGH_EXPECTED),
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(POCKETS_WITH_FIXED.map(p => ({ ...p }))),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      // Total monthly allocation is 7000 (1000 + 3000 + 3000)
      // With 10500 income (< 20000 expected), no surplus, but capping should apply
      const result = await service.createManualIncome({ ...BASE_DTO, amount: 10500 }, 'user-1');

      const rentAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-rent');
      const savingsAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-savings');
      const foodAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-food');

      // Rent should be capped at its monthly_allocation (3000)
      expect(rentAllocation?.amount).toBe(3000);

      // Total allocated should be 10500 (full income, no surplus)
      expect(result.allocation.total_allocated).toBe(10500);

      // Savings and food should receive more than their proportional share due to rent cap
      expect(savingsAllocation?.amount).toBeGreaterThan(1500);
      expect(foodAllocation?.amount).toBeGreaterThan(4500);
    });

    it('does not cap fixed pockets when income is within expected range', async () => {
      const POCKETS_WITH_FIXED = [
        { id: 'pocket-savings', plan_id: 'plan-1', name: 'Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 1000, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-rent', plan_id: 'plan-1', name: 'Rent', kind: 'fixed', category: 'housing', is_time_locked: true, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-food', plan_id: 'plan-1', name: 'Food & Groceries', kind: 'spendable', category: 'food', is_time_locked: false, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
      ];
      const repository = makeRepository({
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(POCKETS_WITH_FIXED.map(p => ({ ...p }))),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      // With 7000 income (exactly equal to total monthly allocation),
      // no capping should occur
      const result = await service.createManualIncome({ ...BASE_DTO, amount: 7000 }, 'user-1');

      const rentAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-rent');
      const savingsAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-savings');
      const foodAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-food');

      // All pockets should get exactly their monthly_allocation
      expect(rentAllocation?.amount).toBe(3000);
      expect(savingsAllocation?.amount).toBe(1000);
      expect(foodAllocation?.amount).toBe(3000);
    });

    it('handles fixed pocket capping with multiple fixed pockets', async () => {
      const POCKETS_WITH_MULTIPLE_FIXED = [
        { id: 'pocket-savings', plan_id: 'plan-1', name: 'Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 1000, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-rent', plan_id: 'plan-1', name: 'Rent', kind: 'fixed', category: 'housing', is_time_locked: true, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-internet', plan_id: 'plan-1', name: 'Internet', kind: 'fixed', category: 'utilities', is_time_locked: true, lock_until: null, monthly_allocation: 1000, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-food', plan_id: 'plan-1', name: 'Food & Groceries', kind: 'spendable', category: 'food', is_time_locked: false, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
      ];
      // Set expected_income_amount high enough that surplus doesn't trigger
      const PLAN_WITH_HIGH_EXPECTED = { 
        ...PLAN, 
        expected_income_amount: 20000 
      };
      const repository = makeRepository({
        getActivePlanByUserId: jest.fn().mockResolvedValue(PLAN_WITH_HIGH_EXPECTED),
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(POCKETS_WITH_MULTIPLE_FIXED.map(p => ({ ...p }))),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      // Total monthly allocation is 8000 (1000 + 3000 + 1000 + 3000)
      // With 12000 income (< 20000 expected), no surplus, but capping should apply
      const result = await service.createManualIncome({ ...BASE_DTO, amount: 12000 }, 'user-1');

      const rentAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-rent');
      const internetAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-internet');
      const savingsAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-savings');
      const foodAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-food');

      // Both fixed pockets should be capped at their monthly_allocation
      expect(rentAllocation?.amount).toBe(3000);
      expect(internetAllocation?.amount).toBe(1000);

      // Total allocated should be 12000 (full income, no surplus)
      expect(result.allocation.total_allocated).toBe(12000);

      // Excess (2000) should be redistributed to savings and food
      expect(savingsAllocation?.amount).toBeGreaterThan(1500);
      expect(foodAllocation?.amount).toBeGreaterThan(4500);
    });

    it('caps fixed pocket taking into account existing balance from prior deposits', async () => {
      const POCKETS_WITH_FIXED = [
        { id: 'pocket-savings', plan_id: 'plan-1', name: 'Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 1000, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-rent', plan_id: 'plan-1', name: 'Rent', kind: 'fixed', category: 'housing', is_time_locked: true, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
        { id: 'pocket-food', plan_id: 'plan-1', name: 'Food & Groceries', kind: 'spendable', category: 'food', is_time_locked: false, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
      ];
      // Rent already has 2500 funded from a prior deposit (out of 3000 target)
      const repository = makeRepository({
        getActivePlanByUserId: jest.fn().mockResolvedValue({ ...PLAN, expected_income_amount: 10000 }),
        getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(POCKETS_WITH_FIXED.map(p => ({ ...p }))),
        getPocketSummary: jest.fn().mockImplementation(async (id: string) => {
          if (id === 'pocket-rent') return { available: 2500, allocated: 2500, spent: 0 };
          return { available: 500, allocated: 500, spent: 0 };
        }),
      } as any);
      const service = new IncomeService(repository, makeRunway(), makePush());

      // Deposit 7000: proportional share for rent would be ~3000, but only 500 is needed to hit 3000 cap!
      const result = await service.createManualIncome({ ...BASE_DTO, amount: 7000 }, 'user-1');
      const rentAllocation = result.allocation.allocations.find(a => a.pocket_id === 'pocket-rent');

      // Rent should receive only 500 (3000 target - 2500 existing)
      expect(rentAllocation?.amount).toBe(500);
      expect(rentAllocation?.is_capped).toBe(true);
      expect(result.allocation.total_allocated).toBe(7000);
    });
  });
});

describe('IncomeService segment awareness (ADR-001 §5.1)', () => {
  it('resolves the Individual plan when no segment is given (backward compat)', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository, makeRunway(), makePush());

    await service.createManualIncome(BASE_DTO, 'user-1');
    expect(repository.getActivePlanByUserId).toHaveBeenCalledWith('user-1', 'individual');
  });

  it('passes the msme segment through to createManualIncome', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository, makeRunway(), makePush());

    await service.createManualIncome({ ...BASE_DTO, segment: 'msme' }, 'user-1');
    expect(repository.getActivePlanByUserId).toHaveBeenCalledWith('user-1', 'msme');
  });

  it('passes the msme segment through to allocatePreview', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository, makeRunway(), makePush());

    await service.allocatePreview({ ...BASE_DTO, segment: 'msme' }, 'user-1');
    expect(repository.getActivePlanByUserId).toHaveBeenCalledWith('user-1', 'msme');
  });

  it('allocates across business fixed/savings/spendable pockets for an msme plan', async () => {
    const MSME_PLAN = {
      ...PLAN,
      id: 'plan-msme',
      segment: 'msme',
      expected_income_amount: 30000,
    };
    const MSME_POCKETS = [
      { id: 'pocket-savings', plan_id: 'plan-msme', name: 'Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
      { id: 'pocket-rent', plan_id: 'plan-msme', name: 'Rent', kind: 'fixed', category: 'rent', is_time_locked: true, lock_until: null, monthly_allocation: 8000, daily_cap: null, created_at: 'x', updated_at: 'x' },
      { id: 'pocket-stock', plan_id: 'plan-msme', name: 'Stock & Inventory', kind: 'spendable', category: 'stock', is_time_locked: false, lock_until: null, monthly_allocation: 12000, daily_cap: null, created_at: 'x', updated_at: 'x' },
      { id: 'pocket-marketing', plan_id: 'plan-msme', name: 'Marketing', kind: 'spendable', category: 'marketing', is_time_locked: false, lock_until: null, monthly_allocation: 4000, daily_cap: null, created_at: 'x', updated_at: 'x' },
    ];
    const repository = makeRepository({
      getActivePlanByUserId: jest.fn().mockResolvedValue(MSME_PLAN as any),
      getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(MSME_POCKETS.map(p => ({ ...p }))),
    } as any);
    const service = new IncomeService(repository, makeRunway(), makePush());

    // Income equal to total monthly allocation (27000) → exact split, no
    // surplus, no fixed-cap redistribution.
    const result = await service.createManualIncome({ ...BASE_DTO, amount: 27000, segment: 'msme' }, 'user-1');

    expect(repository.getActivePlanByUserId).toHaveBeenCalledWith('user-1', 'msme');
    const allocations = result.allocation.allocations;
    expect(allocations.find(a => a.pocket_id === 'pocket-rent')?.amount).toBe(8000);
    expect(allocations.find(a => a.pocket_id === 'pocket-savings')?.amount).toBe(3000);
    expect(allocations.find(a => a.pocket_id === 'pocket-stock')?.amount).toBe(12000);
    expect(allocations.find(a => a.pocket_id === 'pocket-marketing')?.amount).toBe(4000);
    expect(result.allocation.total_allocated).toBe(27000);
  });
});

describe('IncomeService allocateSurplus segment-aware (Phase 2)', () => {
  const MSME_PLAN = {
    id: 'plan-msme',
    user_id: 'user-1',
    type: 'structured',
    income_pattern: 'salaried',
    status: 'active',
    segment: 'msme',
    expected_income_amount: 30000,
  };
  const MSME_POCKETS_ONE_SAVINGS = [
    { id: 'pocket-savings', plan_id: 'plan-msme', name: 'Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
    { id: 'pocket-rent', plan_id: 'plan-msme', name: 'Rent', kind: 'fixed', category: 'rent', is_time_locked: true, lock_until: null, monthly_allocation: 8000, daily_cap: null, created_at: 'x', updated_at: 'x' },
    { id: 'pocket-stock', plan_id: 'plan-msme', name: 'Stock', kind: 'spendable', category: 'stock', is_time_locked: false, lock_until: null, monthly_allocation: 12000, daily_cap: null, created_at: 'x', updated_at: 'x' },
  ];
  const MSME_POCKETS_TWO_SAVINGS = [
    { id: 'pocket-savings-a', plan_id: 'plan-msme', name: 'Emergency Fund', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 2000, daily_cap: null, created_at: 'x', updated_at: 'x' },
    { id: 'pocket-savings-b', plan_id: 'plan-msme', name: 'Goal Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 1000, daily_cap: null, created_at: 'x', updated_at: 'x' },
    { id: 'pocket-rent', plan_id: 'plan-msme', name: 'Rent', kind: 'fixed', category: 'rent', is_time_locked: true, lock_until: null, monthly_allocation: 8000, daily_cap: null, created_at: 'x', updated_at: 'x' },
    { id: 'pocket-stock', plan_id: 'plan-msme', name: 'Stock', kind: 'spendable', category: 'stock', is_time_locked: false, lock_until: null, monthly_allocation: 11000, daily_cap: null, created_at: 'x', updated_at: 'x' },
  ];

  it('allocates surplus to savings pocket for msme segment', async () => {
    const repository = makeRepository({
      getIncomeEventById: jest.fn().mockResolvedValue({
        id: 'evt-1',
        user_id: 'user-1',
        unallocated_surplus: 5000,
        surplus_allocation_status: 'pending',
        segment: 'msme',
      } as any),
      getActivePlanByUserId: jest.fn().mockResolvedValue(MSME_PLAN as any),
      getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(MSME_POCKETS_ONE_SAVINGS.map(p => ({ ...p }))),
      createTransactions: jest.fn().mockResolvedValue([]),
      updateIncomeEvent: jest.fn().mockResolvedValue({}),
    } as any);
    const service = new IncomeService(repository, makeRunway(), makePush());

    const result = await service.allocateSurplus('evt-1', { target: 'savings', segment: 'msme' }, 'user-1');

    expect(repository.getActivePlanByUserId).toHaveBeenCalledWith('user-1', 'msme');
    expect(repository.allocatePendingSurplusAtomic).toHaveBeenCalledWith(
      'evt-1', 'user-1',
      expect.arrayContaining([expect.objectContaining({ pocket_id: 'pocket-savings', amount: 5000 })]),
    );
    expect(result.allocation).not.toBeNull();
    expect(result.allocation!.pocket_id).toBe('pocket-savings');
    expect(result.allocation!.amount).toBe(5000);
  });

  it('splits surplus proportionally across multiple savings pockets for msme', async () => {
    const repository = makeRepository({
      getIncomeEventById: jest.fn().mockResolvedValue({
        id: 'evt-1',
        user_id: 'user-1',
        unallocated_surplus: 6000,
        surplus_allocation_status: 'pending',
        segment: 'msme',
      } as any),
      getActivePlanByUserId: jest.fn().mockResolvedValue(MSME_PLAN as any),
      getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(MSME_POCKETS_TWO_SAVINGS.map(p => ({ ...p }))),
      createTransactions: jest.fn().mockResolvedValue([]),
      updateIncomeEvent: jest.fn().mockResolvedValue({}),
    } as any);
    const service = new IncomeService(repository, makeRunway(), makePush());

    const result = await service.allocateSurplus('evt-1', { target: 'savings', segment: 'msme' }, 'user-1');

    const transactions = repository.allocatePendingSurplusAtomic.mock.calls[0][2];
    const savingsA = transactions.find((t: any) => t.pocket_id === 'pocket-savings-a');
    const savingsB = transactions.find((t: any) => t.pocket_id === 'pocket-savings-b');
    expect(savingsA).toBeDefined();
    expect(savingsB).toBeDefined();
    expect(savingsA!.amount).toBe(4000); // 2000/(2000+1000) * 6000 = 4000
    expect(savingsB!.amount).toBe(2000); // 1000/(2000+1000) * 6000 = 2000
    expect(savingsA!.amount + savingsB!.amount).toBe(6000); // rounding reconciliation
  });

  it('main_pocket surplus stays within the segment — msme surplus does not touch individual plan', async () => {
    const MSME_PLAN_2 = { ...MSME_PLAN, id: 'plan-msme-2' };
    const INDIVIDUAL_PLAN = { ...PLAN, id: 'plan-individual', segment: 'individual' };
    const MSME_POCKETS = [
      { id: 'pocket-msme-savings', plan_id: 'plan-msme-2', name: 'Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 3000, daily_cap: null, created_at: 'x', updated_at: 'x' },
      { id: 'pocket-msme-stock', plan_id: 'plan-msme-2', name: 'Stock', kind: 'spendable', category: 'stock', is_time_locked: false, lock_until: null, monthly_allocation: 10000, daily_cap: null, created_at: 'x', updated_at: 'x' },
    ];
    const INDIVIDUAL_POCKETS = [
      { id: 'pocket-ind-savings', plan_id: 'plan-individual', name: 'Savings', kind: 'savings', category: null, is_time_locked: true, lock_until: null, monthly_allocation: 2000, daily_cap: null, created_at: 'x', updated_at: 'x' },
      { id: 'pocket-ind-food', plan_id: 'plan-individual', name: 'Food', kind: 'spendable', category: 'food', is_time_locked: false, lock_until: null, monthly_allocation: 8000, daily_cap: null, created_at: 'x', updated_at: 'x' },
    ];

    const repository = makeRepository({
      getIncomeEventById: jest.fn().mockResolvedValue({
        id: 'evt-1',
        user_id: 'user-1',
        unallocated_surplus: 5000,
        surplus_allocation_status: 'pending',
        segment: 'msme',
      } as any),
      getActivePlanByUserId: jest.fn()
        .mockResolvedValueOnce(MSME_PLAN_2 as any) // for segment 'msme'
        .mockResolvedValueOnce(INDIVIDUAL_PLAN as any), // fallback
      getTopLevelPocketsByPlanId: jest.fn()
        .mockResolvedValueOnce(MSME_POCKETS.map(p => ({ ...p }))) // for msme plan
        .mockResolvedValueOnce(INDIVIDUAL_POCKETS.map(p => ({ ...p }))), // for individual plan
      createTransactions: jest.fn().mockResolvedValue([]),
      updateIncomeEvent: jest.fn().mockResolvedValue({}),
    } as any);
    const service = new IncomeService(repository, makeRunway(), makePush());

    const result = await service.allocateSurplus('evt-1', { target: 'main_pocket', segment: 'msme' }, 'user-1');

    // Should only call getTopLevelPocketsByPlanId with MSME plan id
    expect(repository.getTopLevelPocketsByPlanId).toHaveBeenCalledWith('plan-msme-2');
    // Should NOT have been called with individual plan
    expect(repository.getTopLevelPocketsByPlanId).not.toHaveBeenCalledWith('plan-individual');
    // Allocations should only go to MSME pockets
    const transactions = repository.allocatePendingSurplusAtomic.mock.calls[0][2];
    const pocketIds = transactions.map((t: any) => t.pocket_id);
    expect(pocketIds).toEqual(expect.arrayContaining(['pocket-msme-savings', 'pocket-msme-stock']));
    expect(pocketIds).not.toEqual(expect.arrayContaining(['pocket-ind-savings', 'pocket-ind-food']));
  });
});
