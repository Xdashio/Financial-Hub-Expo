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