import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ReallocationsService } from './reallocations.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { PushDeliveryService } from '../notifications/push-delivery.service';

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
      // Balance checks are ledger-derived via getPocketSummary, not
      // monthly_allocation — see supabase.repository.ts getPocketSummary
      // and e9924bb "Ledger balance calculation in repository". Default to
      // a large available balance; tests that care about the boundary
      // override this explicitly.
      getPocketSummary: jest.fn().mockResolvedValue({ allocated: 100000, spent: 0, available: 100000, transactionCount: 0, reallocationCount: 0 }),
      updatePocket: jest.fn(),
      createTransactions: jest.fn(),
      createReallocation: jest.fn(),
      getReallocationById: jest.fn(),
      updateReallocation: jest.fn(),
      claimReallocationCompletion: jest.fn().mockResolvedValue({ id: 'realloc-1', status: 'completed' }),
      getReallocationsByUserId: jest.fn(),
      createBehaviorEvent: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReallocationsService,
        { provide: SupabaseRepository, useValue: repo },
        {
          provide: PushDeliveryService,
          useValue: {
            notifyReallocationConfirm: jest.fn().mockResolvedValue({ sent: false }),
            notifyCoolingOffReady: jest.fn().mockResolvedValue({ sent: false }),
          },
        },
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
      // Ledger-derived available balance, not monthly_allocation.
      repo.getPocketSummary.mockResolvedValue({ allocated: 500, spent: 0, available: 500, transactionCount: 0, reallocationCount: 0 });

      await expect(
        service.create('user-123', {
          fromPocketId: FOOD_POCKET.id,
          toPocketId: TRANSPORT_POCKET.id,
          amount: 501,
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

    it('gives an avoider a longer cooling-off window than a spender (money-personality modifier layer, §2.3)', async () => {
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === FOOD_POCKET.id) return FOOD_POCKET as any;
        return LEISURE_POCKET as any;
      });
      repo.createReallocation.mockResolvedValue({ id: 'realloc-x', status: 'cooling_off' } as any);

      repo.getActivePlanByUserId.mockResolvedValue({ ...PLAN, money_personality: 'avoider' } as any);
      await service.create('user-avoider', {
        fromPocketId: FOOD_POCKET.id,
        toPocketId: LEISURE_POCKET.id,
        amount: 500,
        reason: 'other',
      });
      const avoiderEndsAt = new Date(repo.createReallocation.mock.calls[0][0].cooling_off_ends_at as string).getTime();

      repo.getActivePlanByUserId.mockResolvedValue({ ...PLAN, money_personality: 'spender' } as any);
      await service.create('user-spender', {
        fromPocketId: FOOD_POCKET.id,
        toPocketId: LEISURE_POCKET.id,
        amount: 500,
        reason: 'other',
      });
      const spenderEndsAt = new Date(repo.createReallocation.mock.calls[1][0].cooling_off_ends_at as string).getTime();

      // Both computed close to "now" in the same test tick, so comparing the
      // gap between them (rather than absolute values) avoids flakiness.
      expect(avoiderEndsAt - spenderEndsAt).toBeGreaterThan(30 * 60 * 1000); // >30 min further out
    });

    it('attaches cooling_off_framing to the response only when cooling-off applies', async () => {
      repo.getActivePlanByUserId.mockResolvedValue({ ...PLAN, money_personality: 'avoider' } as any);
      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === FOOD_POCKET.id) return FOOD_POCKET as any;
        return LEISURE_POCKET as any;
      });
      repo.createReallocation.mockResolvedValue({ id: 'realloc-y', status: 'cooling_off' } as any);

      const result = await service.create('user-123', {
        fromPocketId: FOOD_POCKET.id,
        toPocketId: LEISURE_POCKET.id,
        amount: 500,
        reason: 'other',
      });

      expect(result.cooling_off_framing).toBeDefined();
      expect(result.cooling_off_framing?.title).toEqual(expect.any(String));

      repo.getPocketById.mockImplementation(async (id: string) => {
        if (id === TRANSPORT_POCKET.id) return TRANSPORT_POCKET as any;
        return LEISURE_POCKET as any;
      });
      repo.createReallocation.mockResolvedValue({ id: 'realloc-z', status: 'pending' } as any);

      const pendingResult = await service.create('user-123', {
        fromPocketId: TRANSPORT_POCKET.id,
        toPocketId: LEISURE_POCKET.id,
        amount: 100,
        reason: 'other',
      });
      expect(pendingResult.cooling_off_framing).toBeUndefined();
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

    it('completes a pending reallocation, moving balances through the atomic RPC', async () => {
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

      // monthly_allocation is the planning ceiling and is never mutated for
      // balance movement — the ledger rows, the status flip, the
      // reallocation_completed behavior event, and any discipline delta all
      // commit inside atomic_complete_reallocation (migration 035), so the
      // service writes nothing here.
      expect(repo.updatePocket).not.toHaveBeenCalled();
      expect(repo.createTransactions).not.toHaveBeenCalled();
      expect(repo.createBehaviorEvent).not.toHaveBeenCalled();
      expect(repo.claimReallocationCompletion).toHaveBeenCalledWith(
        'realloc-1',
        expect.objectContaining({
          discipline_cost: 0,
          userId: 'user-123',
          fromPocketName: 'Transport',
          toPocketName: 'Personal & leisure',
        })
      );
      expect(result).toEqual({ id: 'realloc-1', status: 'completed' });
    });

    it('passes a 5-point discipline cost to the RPC when skipping the cooling-off wait', async () => {
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

      await service.complete('user-123', 'realloc-2', { skipCoolingOff: true });

      expect(repo.claimReallocationCompletion).toHaveBeenCalledWith(
        'realloc-2',
        expect.objectContaining({
          discipline_cost: 5,
          userId: 'user-123',
          fromPocketName: 'Groceries & food',
          toPocketName: 'Personal & leisure',
        })
      );
      // The SKIP_COOLING_OFF_COST delta is applied inside the RPC transaction,
      // never as a separate service write.
      expect(repo.createBehaviorEvent).not.toHaveBeenCalled();
      expect(repo.createTransactions).not.toHaveBeenCalled();
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

      expect(repo.claimReallocationCompletion).toHaveBeenCalledWith(
        'realloc-3',
        expect.objectContaining({ discipline_cost: 0, userId: 'user-123' })
      );
      expect(repo.createBehaviorEvent).not.toHaveBeenCalled();
    });

    it('serializes concurrent completions — the loser gets a clean 400 and no double side-effects', async () => {
      repo.getReallocationById.mockResolvedValue({
        id: 'realloc-race',
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

      // The RPC is the CAS: the first caller wins the row lock and flips the
      // status; the concurrent caller is rejected and surfaces as null.
      repo.claimReallocationCompletion
        .mockResolvedValueOnce({ id: 'realloc-race', status: 'completed', discipline_cost: 5 } as any)
        .mockResolvedValueOnce(null as any);

      const [winner, loser] = await Promise.allSettled([
        service.complete('user-123', 'realloc-race', { skipCoolingOff: true }),
        service.complete('user-123', 'realloc-race', { skipCoolingOff: true }),
      ]);

      expect(winner.status).toBe('fulfilled');
      expect(loser.status).toBe('rejected');
      if (loser.status === 'rejected') {
        expect(loser.reason).toBeInstanceOf(BadRequestException);
      }
      // Side effects commit only in the winner's single RPC transaction.
      expect(repo.createBehaviorEvent).not.toHaveBeenCalled();
      expect(repo.createTransactions).not.toHaveBeenCalled();
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
