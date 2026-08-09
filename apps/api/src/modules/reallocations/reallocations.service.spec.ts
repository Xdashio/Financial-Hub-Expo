import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ReallocationsService } from './reallocations.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';

jest.mock('../../database/supabase.repository');
jest.mock('../../config/supabase.config');

const PLAN = { id: 'plan-1', user_id: 'user-123', status: 'active' };

const FOOD_POCKET = {
  id: '11111111-1111-4111-8111-111111111111',
  plan_id: 'plan-1',
  name: 'Groceries & food',
  kind: 'spendable',
  category: 'food',
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 3660,
  daily_cap: null,
};

const TRANSPORT_POCKET = {
  id: '22222222-2222-4222-8222-222222222222',
  plan_id: 'plan-1',
  name: 'Transport',
  kind: 'spendable',
  category: 'transport',
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 280,
  daily_cap: null,
};

const LEISURE_POCKET = {
  id: '33333333-3333-4333-8333-333333333333',
  plan_id: 'plan-1',
  name: 'Personal & leisure',
  kind: 'spendable',
  category: 'leisure',
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 1040,
  daily_cap: null,
};

const LOCKED_SAVINGS_POCKET = {
  id: '44444444-4444-4444-8444-444444444444',
  plan_id: 'plan-1',
  name: 'Savings',
  kind: 'savings',
  category: null,
  is_time_locked: true,
  lock_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  monthly_allocation: 8500,
  daily_cap: null,
};

describe('ReallocationsService', () => {
  let service: ReallocationsService;
  let repo: jest.Mocked<SupabaseRepository>;

  beforeEach(async () => {
    repo = {
      getActivePlanByUserId: jest.fn(),
      getPlanById: jest.fn(),
      getPocketById: jest.fn(),
      updatePocket: jest.fn(),
      createTransactions: jest.fn(),
      createReallocation: jest.fn(),
      getReallocationById: jest.fn(),
      updateReallocation: jest.fn(),
      getReallocationsByUserId: jest.fn(),
      createBehaviorEvent: jest.fn(),
      getLatestDisciplineScore: jest.fn(),
      upsertDisciplineScore: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReallocationsService,
        DisciplineScoreService,
        { provide: SupabaseRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<ReallocationsService>(ReallocationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('rejects invalid input without touching the repository', async () => {
      await expect(
        service.create('user-123', { fromPocketId: 'not-a-uuid', toPocketId: FOOD_POCKET.id, amount: 100, reason: 'other' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.getActivePlanByUserId).not.toHaveBeenCalled();
    });

    it('rejects source and destination being the same pocket', async () => {
      await expect(
        service.create('user-123', {
          fromPocketId: FOOD_POCKET.id,
          toPocketId: FOOD_POCKET.id,
          amount: 100,
          reason: 'other',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s when the user has no active plan', async () => {
      repo.getActivePlanByUserId.mockResolvedValue(null);

      await expect(
        service.create('user-123', {
          fromPocketId: FOOD_POCKET.id,
          toPocketId: TRANSPORT_POCKET.id,
          amount: 100,
          reason: 'other',
        })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects pockets that belong to another plan', async () => {
      repo.getActivePlanByUserId.mockResolvedValue(PLAN as any);
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === FOOD_POCKET.id) return { ...FOOD_POCKET, plan_id: 'someone-elses-plan' } as any;
        return TRANSPORT_POCKET as any;
      });

      await expect(
        service.create('user-123', {
          fromPocketId: FOOD_POCKET.id,
          toPocketId: TRANSPORT_POCKET.id,
          amount: 100,
          reason: 'other',
        })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a time-locked source pocket', async () => {
      repo.getActivePlanByUserId.mockResolvedValue(PLAN as any);
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === LOCKED_SAVINGS_POCKET.id) return LOCKED_SAVINGS_POCKET as any;
        return LEISURE_POCKET as any;
      });

      await expect(
        service.create('user-123', {
          fromPocketId: LOCKED_SAVINGS_POCKET.id,
          toPocketId: LEISURE_POCKET.id,
          amount: 100,
          reason: 'other',
        })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.createReallocation).not.toHaveBeenCalled();
    });

    it('rejects an amount larger than the source balance', async () => {
      repo.getActivePlanByUserId.mockResolvedValue(PLAN as any);
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === FOOD_POCKET.id) return FOOD_POCKET as any;
        return TRANSPORT_POCKET as any;
      });

      await expect(
        service.create('user-123', {
          fromPocketId: FOOD_POCKET.id,
          toPocketId: TRANSPORT_POCKET.id,
          amount: FOOD_POCKET.monthly_allocation + 1,
          reason: 'other',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a pending reallocation for a non-essential->leisure pair', async () => {
      repo.getActivePlanByUserId.mockResolvedValue(PLAN as any);
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === TRANSPORT_POCKET.id) return TRANSPORT_POCKET as any;
        return LEISURE_POCKET as any;
      });
      repo.createReallocation.mockResolvedValue({ id: 'realloc-1', status: 'pending' } as any);

      const result = await service.create('user-123', {
        fromPocketId: TRANSPORT_POCKET.id,
        toPocketId: LEISURE_POCKET.id,
        amount: 100,
        reason: 'other',
      });

      expect(repo.createReallocation).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', cooling_off_ends_at: null })
      );
      expect(repo.createBehaviorEvent).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-123', type: 'reallocation_initiated' })
      );
      expect(result).toEqual({ id: 'realloc-1', status: 'pending' });
    });

    it('creates a cooling_off reallocation for an essential(food)->leisure pair', async () => {
      repo.getActivePlanByUserId.mockResolvedValue(PLAN as any);
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === FOOD_POCKET.id) return FOOD_POCKET as any;
        return LEISURE_POCKET as any;
      });
      repo.createReallocation.mockResolvedValue({ id: 'realloc-2', status: 'cooling_off' } as any);

      await service.create('user-123', {
        fromPocketId: FOOD_POCKET.id,
        toPocketId: LEISURE_POCKET.id,
        amount: 800,
        reason: 'unexpected_expense',
      });

      const insertArg = repo.createReallocation.mock.calls[0][0];
      expect(insertArg.status).toBe('cooling_off');
      expect(insertArg.cooling_off_ends_at).toBeTruthy();
    });
  });

  describe('complete', () => {
    it('404s when the reallocation does not exist', async () => {
      repo.getReallocationById.mockResolvedValue(null);

      await expect(service.complete('user-123', 'missing', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects completing an already-completed reallocation', async () => {
      repo.getReallocationById.mockResolvedValue({ id: 'realloc-1', status: 'completed' } as any);

      await expect(service.complete('user-123', 'realloc-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a caller who does not own the reallocation', async () => {
      repo.getReallocationById.mockResolvedValue({
        id: 'realloc-1',
        status: 'pending',
        from_pocket_id: TRANSPORT_POCKET.id,
        to_pocket_id: LEISURE_POCKET.id,
        amount: 100,
      } as any);
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === TRANSPORT_POCKET.id) return TRANSPORT_POCKET as any;
        return LEISURE_POCKET as any;
      });
      repo.getPlanById.mockResolvedValue({ id: 'plan-1', user_id: 'someone-else' } as any);

      await expect(service.complete('user-123', 'realloc-1', {})).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects completing before the cooling-off window ends', async () => {
      repo.getReallocationById.mockResolvedValue({
        id: 'realloc-1',
        status: 'cooling_off',
        from_pocket_id: FOOD_POCKET.id,
        to_pocket_id: LEISURE_POCKET.id,
        amount: 800,
        cooling_off_ends_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      } as any);
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === FOOD_POCKET.id) return FOOD_POCKET as any;
        return LEISURE_POCKET as any;
      });
      repo.getPlanById.mockResolvedValue(PLAN as any);

      await expect(service.complete('user-123', 'realloc-1', { skipCoolingOff: false })).rejects.toBeInstanceOf(
        BadRequestException
      );
    });

    it('completes a pending reallocation, moving balances and logging a behavior event', async () => {
      repo.getReallocationById.mockResolvedValue({
        id: 'realloc-1',
        status: 'pending',
        from_pocket_id: TRANSPORT_POCKET.id,
        to_pocket_id: LEISURE_POCKET.id,
        amount: 100,
      } as any);
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === TRANSPORT_POCKET.id) return { ...TRANSPORT_POCKET } as any;
        return { ...LEISURE_POCKET } as any;
      });
      repo.getPlanById.mockResolvedValue(PLAN as any);
      repo.updateReallocation.mockResolvedValue({ id: 'realloc-1', status: 'completed' } as any);

      const result = await service.complete('user-123', 'realloc-1', {});

      expect(repo.updatePocket).toHaveBeenCalledWith(TRANSPORT_POCKET.id, { monthly_allocation: 180 });
      expect(repo.updatePocket).toHaveBeenCalledWith(LEISURE_POCKET.id, { monthly_allocation: 1140 });
      expect(repo.createTransactions).toHaveBeenCalledWith([
        { pocket_id: TRANSPORT_POCKET.id, amount: -100, type: 'reallocation_out' },
        { pocket_id: LEISURE_POCKET.id, amount: 100, type: 'reallocation_in' },
      ]);
      expect(repo.updateReallocation).toHaveBeenCalledWith(
        'realloc-1',
        expect.objectContaining({ status: 'completed', discipline_cost: 0 })
      );
      expect(repo.upsertDisciplineScore).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'realloc-1', status: 'completed' });
    });

    it('applies a 5-point discipline cost when skipping the cooling-off wait', async () => {
      repo.getReallocationById.mockResolvedValue({
        id: 'realloc-2',
        status: 'cooling_off',
        from_pocket_id: FOOD_POCKET.id,
        to_pocket_id: LEISURE_POCKET.id,
        amount: 800,
        cooling_off_ends_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      } as any);
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === FOOD_POCKET.id) return { ...FOOD_POCKET } as any;
        return { ...LEISURE_POCKET } as any;
      });
      repo.getPlanById.mockResolvedValue(PLAN as any);
      repo.updateReallocation.mockResolvedValue({ id: 'realloc-2', status: 'completed', discipline_cost: 5 } as any);
      repo.getLatestDisciplineScore.mockResolvedValue({ score: 87, delta: 3 } as any);

      await service.complete('user-123', 'realloc-2', { skipCoolingOff: true });

      expect(repo.updateReallocation).toHaveBeenCalledWith(
        'realloc-2',
        expect.objectContaining({ discipline_cost: 5 })
      );
      expect(repo.upsertDisciplineScore).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-123', score: 82, delta: -5 })
      );
    });

    it('allows completing a cooling_off reallocation once the window has passed, without a discipline cost', async () => {
      repo.getReallocationById.mockResolvedValue({
        id: 'realloc-3',
        status: 'cooling_off',
        from_pocket_id: FOOD_POCKET.id,
        to_pocket_id: LEISURE_POCKET.id,
        amount: 800,
        cooling_off_ends_at: new Date(Date.now() - 1000).toISOString(),
      } as any);
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === FOOD_POCKET.id) return { ...FOOD_POCKET } as any;
        return { ...LEISURE_POCKET } as any;
      });
      repo.getPlanById.mockResolvedValue(PLAN as any);
      repo.updateReallocation.mockResolvedValue({ id: 'realloc-3', status: 'completed', discipline_cost: 0 } as any);

      await service.complete('user-123', 'realloc-3', { skipCoolingOff: false });

      expect(repo.updateReallocation).toHaveBeenCalledWith(
        'realloc-3',
        expect.objectContaining({ discipline_cost: 0 })
      );
      expect(repo.upsertDisciplineScore).not.toHaveBeenCalled();
    });
  });

  describe('getForUser', () => {
    it('delegates to the repository', async () => {
      repo.getReallocationsByUserId.mockResolvedValue([{ id: 'realloc-1' }] as any);

      const result = await service.getForUser('user-123');

      expect(repo.getReallocationsByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toEqual([{ id: 'realloc-1' }]);
    });
  });
});