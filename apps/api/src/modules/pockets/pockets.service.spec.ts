import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PocketsService } from './pockets.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import type { RunwayService } from '../runway/runway.service';

const POCKET = {
  id: 'pocket-1',
  plan_id: 'plan-1',
  name: 'Savings',
  kind: 'savings',
  category: null,
  is_time_locked: true,
  lock_until: '2099-01-01T00:00:00.000Z',
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
    lock_until: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  };

  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      'getPocketById' | 'getPlanById' | 'updatePocket' | 'createBehaviorEvent' | 'createTransaction' | 'getTransactionsByPocketId'
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
    } as any;
    disciplineScore = {
      getCurrentScore: jest.fn(),
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

  it('extendLock applies a positive bonus through the shared DisciplineScoreService', async () => {
    const result = await service.extendLock('pocket-1', 'user-1', { additional_days: 10, reason: 'staying disciplined' });

    expect(disciplineScore.applyDelta).toHaveBeenCalledWith('user-1', expect.any(Number));
    const [, delta] = disciplineScore.applyDelta.mock.calls[0];
    expect(delta).toBeGreaterThan(0); // extension is a bonus, never a cost
    expect(result.discipline_bonus.previous_score).toBe(100);
    expect(result.discipline_bonus.new_score).toBe(95);
  });
});

describe('PocketsService sub-pockets (audit_team.md item 10)', () => {
  const PARENT = { ...POCKET, id: 'parent-1', monthly_allocation: 1000, parent_pocket_id: null };
  const SUB_POCKET_OF_SUB_POCKET_PARENT = { ...POCKET, id: 'sub-1', parent_pocket_id: 'parent-1' };

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
    } as any;
    disciplineScore = { getCurrentScore: jest.fn(), applyDelta: jest.fn() } as any;
    runway = { getRunwayForPlan: jest.fn().mockResolvedValue({ applicable: false }) } as any;
    service = new PocketsService(repository as unknown as SupabaseRepository, disciplineScore, runway as unknown as RunwayService);
  });

  it('creates a sub-pocket that inherits the parent kind and links parent_pocket_id', async () => {
    const created = await service.createSubPocket('parent-1', 'user-1', {
      name: 'School fees',
      monthlyAllocation: 400,
    });
    expect(repository.createPocket).toHaveBeenCalledWith(
      expect.objectContaining({ parent_pocket_id: 'parent-1', kind: PARENT.kind, monthly_allocation: 400 }),
    );
    expect(created.id).toBe('new-sub');
  });

  it('rejects creating a sub-pocket under a pocket that is itself a sub-pocket (depth cap)', async () => {
    repository.getPocketById.mockResolvedValue(SUB_POCKET_OF_SUB_POCKET_PARENT as any);
    await expect(
      service.createSubPocket('sub-1', 'user-1', { name: 'Nested', monthlyAllocation: 100 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createPocket).not.toHaveBeenCalled();
  });

  it('rejects a sub-pocket split that would exceed the parent allocation', async () => {
    repository.getSubPocketsByParentId.mockResolvedValue([{ ...POCKET, monthly_allocation: 700 } as any]);
    await expect(
      service.createSubPocket('parent-1', 'user-1', { name: 'Too much', monthlyAllocation: 400 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createPocket).not.toHaveBeenCalled();
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