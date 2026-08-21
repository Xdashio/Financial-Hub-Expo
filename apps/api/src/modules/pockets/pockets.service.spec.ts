import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PocketsService } from './pockets.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import type { RunwayService } from '../runway/runway.service';

const POCKET = {
  id: 'pocket-1',
  plan_id: 'plan-1',
  name: 'Spendable',
  kind: 'spendable',
  category: null,
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 1000,
  daily_cap: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('PocketsService.updateForUser', () => {
  let repository: jest.Mocked<Pick<SupabaseRepository, 'getPocketById' | 'getPlanById' | 'updatePocket'>>;
  let disciplineScore: jest.Mocked<DisciplineScoreService>;
  let runway: jest.Mocked<Pick<RunwayService, 'getRunwayForPlan'>>;
  let service: PocketsService;

  beforeEach(() => {
    repository = {
      getPocketById: jest.fn().mockResolvedValue(POCKET),
      getPlanById: jest.fn().mockResolvedValue({ id: 'plan-1', user_id: 'user-1' }),
      updatePocket: jest.fn().mockImplementation((id, updates) => ({ ...POCKET, ...updates })),
    } as any;
    disciplineScore = {
      getCurrentScore: jest.fn(),
      applyDelta: jest.fn(),
    } as any;
    runway = {
      getRunwayForPlan: jest.fn().mockResolvedValue({ applicable: false }),
    } as any;
    service = new PocketsService(repository as unknown as SupabaseRepository, disciplineScore, runway as unknown as RunwayService);
  });

  it('applies whitelisted fields', async () => {
    await service.updateForUser('pocket-1', 'user-1', { name: 'Rainy day', dailyCap: 250 });
    expect(repository.updatePocket).toHaveBeenCalledWith('pocket-1', { name: 'Rainy day', daily_cap: 250 });
  });

  it('rejects balance, ownership and time-lock fields', async () => {
    const payloads = [
      { monthly_allocation: 999999 },
      { plan_id: 'someone-elses-plan' },
      { is_time_locked: false },
      { lock_until: null },
    ];
    for (const payload of payloads) {
      await expect(service.updateForUser('pocket-1', 'user-1', payload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect(repository.updatePocket).not.toHaveBeenCalled();
  });

  it('rejects updates to another user\'s pocket', async () => {
    repository.getPlanById.mockResolvedValue({ id: 'plan-1', user_id: 'user-2' } as any);
    await expect(service.updateForUser('pocket-1', 'user-1', { name: 'Mine now' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.updatePocket).not.toHaveBeenCalled();
  });
});

describe('PocketsService discipline-score unification', () => {
  const LOCKED_POCKET = {
    ...POCKET,
    is_time_locked: true,
    lock_until: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  };

  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      'getPocketById' | 'getPlanById' | 'updatePocket' | 'createBehaviorEvent' | 'createTransaction' | 'getTransactionsByPocketId' | 'getBehaviorEventsByTypesSince'
    >
  >;
  let disciplineScore: jest.Mocked<DisciplineScoreService>;
  let runway: jest.Mocked<Pick<RunwayService, 'getRunwayForPlan'>>;
  let service: PocketsService;

  beforeEach(() => {
    repository = {
      getPocketById: jest.fn().mockResolvedValue(LOCKED_POCKET),
      getPlanById: jest.fn().mockResolvedValue({ id: 'plan-1', user_id: 'user-1' }),
      updatePocket: jest.fn().mockImplementation((id, updates) => ({ ...LOCKED_POCKET, ...updates })),
      createBehaviorEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
      createTransaction: jest.fn().mockResolvedValue({ id: 'txn-1' }),
      getTransactionsByPocketId: jest.fn().mockResolvedValue([]),
      getBehaviorEventsByTypesSince: jest.fn().mockResolvedValue([]),
    } as any;
    disciplineScore = {
      getCurrentScore: jest.fn().mockResolvedValue(100),
      applyDelta: jest.fn().mockResolvedValue({ previousScore: 100, newScore: 95 }),
    } as any;
    runway = {
      getRunwayForPlan: jest.fn().mockResolvedValue({ applicable: false }),
    } as any;
    service = new PocketsService(repository as unknown as SupabaseRepository, disciplineScore, runway as unknown as RunwayService);
  });

  it('unlockPocket applies the cost through the shared DisciplineScoreService, not a local calculation', async () => {
    const result = await service.unlockPocket('pocket-1', 'user-1', { biometric_confirmed: true, reason: 'emergency' });

    expect(disciplineScore.applyDelta).toHaveBeenCalledWith('user-1', expect.any(Number));
    const [, delta] = disciplineScore.applyDelta.mock.calls[0];
    expect(delta).toBeLessThan(0); // unlock is a cost, never a bonus
    expect(result.discipline_cost.previous_score).toBe(100);
    expect(result.discipline_cost.new_score).toBe(95);
  });

  it('extendLock no longer grants a discipline bonus (points removed, extension still applies)', async () => {
    const result = await service.extendLock('pocket-1', 'user-1', { additional_days: 10, reason: 'staying disciplined' });

    // The lock itself still extends and the response still returns a
    // discipline_bonus object (for API shape compatibility), but it must
    // not touch the score — applyDelta is only for costs like unlockPocket
    // above, never for extending a lock.
    expect(disciplineScore.applyDelta).not.toHaveBeenCalled();
    expect(result.discipline_bonus.points_added).toBe(0);
    expect(result.discipline_bonus.previous_score).toBe(100);
    expect(result.discipline_bonus.new_score).toBe(100);
    expect(result.extension.days_added).toBe(10);
  });

  it('extendLock rejects a pocket that has already been extended once this lock term', async () => {
    repository.getBehaviorEventsByTypesSince.mockResolvedValue([
      {
        id: 'event-prev',
        user_id: 'user-1',
        type: 'lock_extension',
        payload: { pocket_id: 'pocket-1', days_added: 30, points_added: 6 },
        created_at: '2026-01-15T00:00:00.000Z', // well within the lock term, long ago
      } as any,
    ]);

    await expect(
      service.extendLock('pocket-1', 'user-1', { additional_days: 30, reason: 'farming points' })
    ).rejects.toThrow(/already been extended once/i);

    expect(disciplineScore.applyDelta).not.toHaveBeenCalled();
    expect(repository.updatePocket).not.toHaveBeenCalled();
  });

  it('extendLock ignores prior extensions on a different pocket', async () => {
    repository.getBehaviorEventsByTypesSince.mockResolvedValue([
      {
        id: 'event-prev',
        user_id: 'user-1',
        type: 'lock_extension',
        payload: { pocket_id: 'some-other-pocket' },
        created_at: '2026-01-15T00:00:00.000Z',
      } as any,
    ]);

    const result = await service.extendLock('pocket-1', 'user-1', { additional_days: 10, reason: 'staying disciplined' });

    expect(result.discipline_bonus.new_score).toBe(100); // unchanged — no bonus is applied
    expect(result.extension.days_added).toBe(10);
  });

  it('extendLock rejects an extension inside the blackout window before unlock', async () => {
    repository.getPocketById.mockResolvedValue({
      ...LOCKED_POCKET,
      lock_until: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days out, inside the 7-day blackout
    } as any);

    await expect(
      service.extendLock('pocket-1', 'user-1', { additional_days: 30, reason: 'last-minute farming' })
    ).rejects.toThrow(/more than 7 days before it unlocks/i);

    expect(repository.getBehaviorEventsByTypesSince).not.toHaveBeenCalled();
    expect(disciplineScore.applyDelta).not.toHaveBeenCalled();
    expect(repository.updatePocket).not.toHaveBeenCalled();
  });
});

describe('PocketsService sub-pockets (audit_team.md item 10)', () => {
  const PARENT = { ...POCKET, id: '550e8400-e29b-41d4-a716-446655440000', monthly_allocation: 1000, parent_pocket_id: null, split_percentage: null };
  const SUB_POCKET_OF_SUB_POCKET_PARENT = { ...POCKET, id: '550e8400-e29b-41d4-a716-446655440001', parent_pocket_id: '550e8400-e29b-41d4-a716-446655440000', split_percentage: 20 };

  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      | 'getPocketById'
      | 'getPlanById'
      | 'getSubPocketsByParentId'
      | 'createPocket'
      | 'deletePocket'
      | 'getPocketSummary'
      | 'getTopLevelPocketsByPlanId'
      | 'getActivePlanByUserId'
      | 'createTransaction'
      | 'createTransactions'
      | 'updatePocket'
    >
  >;
  let disciplineScore: jest.Mocked<DisciplineScoreService>;
  let runway: jest.Mocked<Pick<RunwayService, 'getRunwayForPlan'>>;
  let service: PocketsService;

  beforeEach(() => {
    repository = {
      getPocketById: jest.fn().mockResolvedValue(PARENT),
      getPlanById: jest.fn().mockResolvedValue({ id: 'plan-1', user_id: 'user-1' }),
      getSubPocketsByParentId: jest.fn().mockResolvedValue([]),
      createPocket: jest.fn().mockImplementation((insert) => ({ id: 'new-sub', ...insert })),
      deletePocket: jest.fn().mockResolvedValue(undefined),
      getPocketSummary: jest.fn().mockResolvedValue({ available: 0 }),
      getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue([PARENT]),
      getActivePlanByUserId: jest.fn().mockResolvedValue({ id: 'plan-1', user_id: 'user-1' }),
      createTransaction: jest.fn().mockResolvedValue({ id: 'txn-1' }),
      createTransactions: jest.fn().mockResolvedValue([]),
      updatePocket: jest.fn().mockImplementation((id, updates) => ({ id, ...updates })),
    } as any;
    disciplineScore = { getCurrentScore: jest.fn(), applyDelta: jest.fn() } as any;
    runway = { getRunwayForPlan: jest.fn().mockResolvedValue({ applicable: false }) } as any;
    service = new PocketsService(repository as unknown as SupabaseRepository, disciplineScore, runway as unknown as RunwayService);
  });

  it('creates a sub-pocket with split_percentage and derives monthly_allocation', async () => {
    const created = await service.createSubPocket('550e8400-e29b-41d4-a716-446655440000', 'user-1', {
      name: 'School fees',
      splitPercentage: 40,
    });
    expect(repository.createPocket).toHaveBeenCalledWith(
      expect.objectContaining({ 
        parent_pocket_id: '550e8400-e29b-41d4-a716-446655440000', 
        kind: PARENT.kind, 
        split_percentage: 40,
        monthly_allocation: 400 // 1000 * 40 / 100
      }),
    );
    expect(created.id).toBe('new-sub');
  });

  it('rejects creating a sub-pocket under a pocket that is itself a sub-pocket (depth cap)', async () => {
    repository.getPocketById.mockResolvedValue(SUB_POCKET_OF_SUB_POCKET_PARENT as any);
    await expect(
      service.createSubPocket('sub-1', 'user-1', { name: 'Nested', splitPercentage: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createPocket).not.toHaveBeenCalled();
  });

  it('rejects a sub-pocket split that would exceed 100% total with siblings', async () => {
    repository.getSubPocketsByParentId.mockResolvedValue([{ ...POCKET, split_percentage: 70 } as any]);
    await expect(
      service.createSubPocket('parent-1', 'user-1', { name: 'Too much', splitPercentage: 40 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createPocket).not.toHaveBeenCalled();
  });

  it('allows a sub-pocket split that keeps total at exactly 100%', async () => {
    repository.getSubPocketsByParentId.mockResolvedValue([{ ...POCKET, split_percentage: 60 } as any]);
    const created = await service.createSubPocket('parent-1', 'user-1', { name: 'Remaining', splitPercentage: 40 });
    expect(repository.createPocket).toHaveBeenCalled();
    expect(created.id).toBe('new-sub');
  });

  it('refuses to delete a sub-pocket that still holds a balance', async () => {
    repository.getPocketById.mockResolvedValue(SUB_POCKET_OF_SUB_POCKET_PARENT as any);
    repository.getPocketSummary.mockResolvedValue({ available: 250 } as any);
    await expect(service.deleteSubPocket('sub-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.deletePocket).not.toHaveBeenCalled();
  });

  it('refuses to delete a top-level pocket through the sub-pocket delete path', async () => {
    repository.getPocketById.mockResolvedValue(PARENT as any);
    await expect(service.deleteSubPocket('parent-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.deletePocket).not.toHaveBeenCalled();
  });

  it('deletes an empty sub-pocket', async () => {
    repository.getPocketById.mockResolvedValue(SUB_POCKET_OF_SUB_POCKET_PARENT as any);
    repository.getPocketSummary.mockResolvedValue({ available: 0 } as any);
    await service.deleteSubPocket('sub-1', 'user-1');
    expect(repository.deletePocket).toHaveBeenCalledWith('sub-1');
  });

  it('getAllForUser excludes sub-pockets from the top-level list (regression guard)', async () => {
    // getTopLevelPocketsByPlanId is the DB-filtered call — if getAllForUser
    // ever regresses to calling the unfiltered getPocketsByPlanId instead,
    // this assertion (and not just a manual QA pass) will catch it.
    await service.getAllForUser('user-1');
    expect(repository.getTopLevelPocketsByPlanId).toHaveBeenCalledWith('plan-1');
  });

  describe('rebalanceSubPockets - immediate percentage adjustment', () => {
    it('rebalances siblings when increasing one sub-pocket percentage', async () => {
      const siblings = [
        { ...POCKET, id: '550e8400-e29b-41d4-a716-446655440002', parent_pocket_id: '550e8400-e29b-41d4-a716-446655440000', split_percentage: 30, monthly_allocation: 300 },
        { ...POCKET, id: '550e8400-e29b-41d4-a716-446655440003', parent_pocket_id: '550e8400-e29b-41d4-a716-446655440000', split_percentage: 20, monthly_allocation: 200 },
      ];
      repository.getSubPocketsByParentId.mockResolvedValue(siblings as any);
      repository.getPocketSummary.mockResolvedValue({ available: 500 } as any); // Parent has 500 available

      const result = await service.rebalanceSubPockets('550e8400-e29b-41d4-a716-446655440000', 'user-1', {
        splits: [
          { pocketId: '550e8400-e29b-41d4-a716-446655440002', splitPercentage: 50 },
          { pocketId: '550e8400-e29b-41d4-a716-446655440003', splitPercentage: 20 },
        ],
      });

      expect(result.applied).toBe(true);
      expect(repository.updatePocket).toHaveBeenCalled();
    });

    it('returns shortfall when rebalance requires more than available parent balance', async () => {
      const siblings = [
        { ...POCKET, id: '550e8400-e29b-41d4-a716-446655440002', parent_pocket_id: '550e8400-e29b-41d4-a716-446655440000', split_percentage: 30, monthly_allocation: 300 },
      ];
      repository.getSubPocketsByParentId.mockResolvedValue(siblings as any);
      repository.getPocketSummary.mockResolvedValue({ available: 100 } as any); // Only 100 available

      const result = await service.rebalanceSubPockets('550e8400-e29b-41d4-a716-446655440000', 'user-1', {
        splits: [
          { pocketId: '550e8400-e29b-41d4-a716-446655440002', splitPercentage: 80 }, // Needs 500 more (80% of 1000 = 800 vs current 300)
        ],
      });

      expect(result.applied).toBe(false);
      expect(result.shortfall).toBeGreaterThan(0);
    });

    it('applies partial rebalance when confirmPartial is true despite shortfall', async () => {
      const siblings = [
        { ...POCKET, id: '550e8400-e29b-41d4-a716-446655440002', parent_pocket_id: '550e8400-e29b-41d4-a716-446655440000', split_percentage: 30, monthly_allocation: 300 },
      ];
      repository.getSubPocketsByParentId.mockResolvedValue(siblings as any);
      repository.getPocketSummary.mockResolvedValue({ available: 100 } as any);

      const result = await service.rebalanceSubPockets('550e8400-e29b-41d4-a716-446655440000', 'user-1', {
        splits: [
          { pocketId: '550e8400-e29b-41d4-a716-446655440002', splitPercentage: 80 },
        ],
        confirmPartial: true,
      });

      expect(result.applied).toBe(true);
      if (result.applied) {
        expect(result.partial).toBe(true);
      }
    });

    it('shrinks siblings proportionally when one grows', async () => {
      const siblings = [
        { ...POCKET, id: '550e8400-e29b-41d4-a716-446655440002', parent_pocket_id: '550e8400-e29b-41d4-a716-446655440000', split_percentage: 30, monthly_allocation: 300 },
        { ...POCKET, id: '550e8400-e29b-41d4-a716-446655440003', parent_pocket_id: '550e8400-e29b-41d4-a716-446655440000', split_percentage: 30, monthly_allocation: 300 },
        { ...POCKET, id: '550e8400-e29b-41d4-a716-446655440004', parent_pocket_id: '550e8400-e29b-41d4-a716-446655440000', split_percentage: 20, monthly_allocation: 200 },
      ];
      repository.getSubPocketsByParentId.mockResolvedValue(siblings as any);
      repository.getPocketSummary.mockResolvedValue({ available: 500 } as any);

      const result = await service.rebalanceSubPockets('550e8400-e29b-41d4-a716-446655440000', 'user-1', {
        splits: [
          { pocketId: '550e8400-e29b-41d4-a716-446655440002', splitPercentage: 50 }, // Growing by 20%
          { pocketId: '550e8400-e29b-41d4-a716-446655440003', splitPercentage: 30 },
          { pocketId: '550e8400-e29b-41d4-a716-446655440004', splitPercentage: 20 },
        ],
      });

      expect(result.applied).toBe(true);
      // sub-2 and sub-3 should be proportionally scaled down to make room
      expect(repository.updatePocket).toHaveBeenCalled();
    });
  });
});

describe('PocketsService allocation integrity (audit_team.md item 4/5, part 1)', () => {
  const PLAN_WITH_INCOME = { id: 'plan-1', user_id: 'user-1', expected_income_amount: 1000 };
  const PLAN_WITHOUT_INCOME = { id: 'plan-1', user_id: 'user-1', expected_income_amount: null };
  const EXISTING = [
    { ...POCKET, id: 'p-fixed', monthly_allocation: 600 },
    { ...POCKET, id: 'p-savings', monthly_allocation: 300 },
  ];

  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      'getActivePlanByUserId' | 'getTopLevelPocketsByPlanId' | 'createPocket'
    >
  >;
  let disciplineScore: jest.Mocked<DisciplineScoreService>;
  let runway: jest.Mocked<Pick<RunwayService, 'getRunwayForPlan'>>;
  let service: PocketsService;

  beforeEach(() => {
    repository = {
      getActivePlanByUserId: jest.fn().mockResolvedValue(PLAN_WITH_INCOME),
      getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue(EXISTING),
      createPocket: jest.fn().mockImplementation((insert) => ({ id: 'new-pocket', ...insert })),
    } as any;
    disciplineScore = { getCurrentScore: jest.fn(), applyDelta: jest.fn() } as any;
    runway = { getRunwayForPlan: jest.fn().mockResolvedValue({ applicable: false }) } as any;
    service = new PocketsService(repository as unknown as SupabaseRepository, disciplineScore, runway as unknown as RunwayService);
  });

  it('allows a new pocket that fits within the remaining unallocated income', async () => {
    // 600 + 300 existing = 900; income is 1000, so 100 is still free.
    const created = await service.createForUser('user-1', { name: 'Transport', monthlyAllocation: 100 });
    expect(created.name).toBe('Transport');
    expect(repository.createPocket).toHaveBeenCalled();
  });

  it('allows a new pocket that lands exactly on 100% allocation', async () => {
    await service.createForUser('user-1', { name: 'Transport', monthlyAllocation: 100 });
    expect(repository.createPocket).toHaveBeenCalled();
  });

  it('rejects a new pocket that would push total allocation past the plan income', async () => {
    await expect(
      service.createForUser('user-1', { name: 'Too much', monthlyAllocation: 150 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createPocket).not.toHaveBeenCalled();
  });

  it('does not block creation when the plan has no known income baseline (older plans)', async () => {
    repository.getActivePlanByUserId.mockResolvedValue(PLAN_WITHOUT_INCOME as any);
    await service.createForUser('user-1', { name: 'Anything', monthlyAllocation: 999999 });
    expect(repository.createPocket).toHaveBeenCalled();
  });

  it('getAllocationSummaryForUser reports unallocated remainder and flags', async () => {
    const summary = await service.getAllocationSummaryForUser('user-1');
    expect(summary).toEqual({
      plan_income: 1000,
      total_allocated: 900,
      unallocated: 100,
      is_fully_allocated: false,
      is_over_allocated: false,
    });
  });

  it('getAllocationSummaryForUser flags is_fully_allocated once pockets sum to income', async () => {
    repository.getTopLevelPocketsByPlanId.mockResolvedValue([
      { ...POCKET, id: 'p-fixed', monthly_allocation: 700 },
      { ...POCKET, id: 'p-savings', monthly_allocation: 300 },
    ] as any);
    const summary = await service.getAllocationSummaryForUser('user-1');
    expect(summary.is_fully_allocated).toBe(true);
    expect(summary.is_over_allocated).toBe(false);
  });
});