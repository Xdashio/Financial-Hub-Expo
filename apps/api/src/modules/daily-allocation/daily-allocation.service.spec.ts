import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DailyAllocationService } from './daily-allocation.service';
import type { SupabaseRepository } from '../../database/supabase.repository';

jest.mock('../../database/supabase.repository');
jest.mock('../../config/supabase.config');

const OPEN_ROW = {
  id: 'da-1',
  plan_id: 'plan-1',
  user_id: 'user-1',
  allocation_date: '2026-09-16',
  planned_amount: 1000,
  actual_spend: 0,
  returned_amount: 0,
  overspend_amount: 0,
  runway_days_at_open: 15,
  runway_days_at_close: null,
  status: 'open',
  created_at: '2026-09-16T00:00:00.000Z',
  closed_at: null,
};

describe('DailyAllocationService', () => {
  let service: DailyAllocationService;
  let repo: jest.Mocked<SupabaseRepository>;

  beforeEach(async () => {
    repo = {
      createDailyAllocationAtomic: jest.fn(),
      closeDailyAllocationAtomic: jest.fn(),
      getDailyAllocationByPlanIdAndDate: jest.fn(),
      getPlanById: jest.fn(),
    } as any;
    service = new DailyAllocationService(repo);
  });

  const today = new Date('2026-09-16T10:00:00.000Z');

  describe('createDailyAllocation', () => {
    it('creates exactly one open row for the day via the atomic RPC', async () => {
      repo.createDailyAllocationAtomic.mockResolvedValue(OPEN_ROW);

      const result = await service.createDailyAllocation('user-1', 'plan-1', 1000, today);

      expect(repo.createDailyAllocationAtomic).toHaveBeenCalledWith({
        planId: 'plan-1',
        userId: 'user-1',
        allocationDate: '2026-09-16',
        plannedAmount: 1000,
      });
      expect(result).toEqual(OPEN_ROW);
      // The old decomposed path (separate read -> insert -> ledger write) is
      // gone; the RPC is the only write the service makes.
      expect(repo.getDailyAllocationByPlanIdAndDate).not.toHaveBeenCalled();
    });

    it('returns the existing same-day row on a second call (same-day create is idempotent)', async () => {
      repo.createDailyAllocationAtomic.mockResolvedValue(OPEN_ROW);

      const first = await service.createDailyAllocation('user-1', 'plan-1', 1000, today);
      const second = await service.createDailyAllocation('user-1', 'plan-1', 1000, today);

      expect(repo.createDailyAllocationAtomic).toHaveBeenCalledTimes(2);
      expect(first.id).toBe('da-1');
      expect(second.id).toBe('da-1');
    });

    it('maps an RPC rejection to a clean 404 (no partial row)', async () => {
      repo.createDailyAllocationAtomic.mockResolvedValue(null);

      await expect(service.createDailyAllocation('user-1', 'unknown-plan', 1000, today)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('serializes concurrent creates into a single row — both callers observe the same row, no double-write', async () => {
      // The plan-row lock inside atomic_create_daily_allocation means the
      // loser of a same-day race gets the winner's already-committed row
      // rather than inserting a second one (unique per plan+date).
      repo.createDailyAllocationAtomic
        .mockResolvedValueOnce({ ...OPEN_ROW, id: 'da-1' })
        .mockResolvedValueOnce({ ...OPEN_ROW, id: 'da-1' });

      const [a, b] = await Promise.all([
        service.createDailyAllocation('user-1', 'plan-1', 1000, today),
        service.createDailyAllocation('user-1', 'plan-1', 1000, today),
      ]);

      expect(repo.createDailyAllocationAtomic).toHaveBeenCalledTimes(2);
      expect(a.id).toBe(b.id);
      expect(a.id).toBe('da-1');
    });
  });

  describe('closeDailyAllocation', () => {
    const CLOSED_ROW = {
      ...OPEN_ROW,
      actual_spend: 700,
      returned_amount: 300,
      overspend_amount: 0,
      status: 'closed',
      closed_at: '2026-09-16T23:00:00.000Z',
      runway_days_at_close: 15,
    };

    it('closes the allocation exactly once via the atomic RPC', async () => {
      repo.closeDailyAllocationAtomic.mockResolvedValue(CLOSED_ROW);

      const result: any = await service.closeDailyAllocation('da-1', 700);

      expect(repo.closeDailyAllocationAtomic).toHaveBeenCalledWith('da-1', 700);
      expect(result.status).toBe('closed');
      expect(result.returned_amount).toBe(300);
    });

    it('returns the already-closed row unchanged on a second close (idempotent sweep)', async () => {
      repo.closeDailyAllocationAtomic.mockResolvedValue(CLOSED_ROW);

      await service.closeDailyAllocation('da-1', 700);
      const second = await service.closeDailyAllocation('da-1', 700);

      expect(repo.closeDailyAllocationAtomic).toHaveBeenCalledTimes(2);
      expect(second.status).toBe('closed');
    });

    it('maps an RPC rejection to a clean 400', async () => {
      repo.closeDailyAllocationAtomic.mockResolvedValue(null);

      await expect(service.closeDailyAllocation('missing', 700)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects non-finite actualSpend before calling the RPC (M1 money bounds)', async () => {
      await expect(service.closeDailyAllocation('da-1', Number.NaN)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.closeDailyAllocationAtomic).not.toHaveBeenCalled();
    });

    it('concurrent closes are idempotent — both callers get the closed row (037)', async () => {
      // Real atomic_close_daily_allocation returns the already-closed row on
      // a second claim rather than null; both callers succeed, one logical close.
      repo.closeDailyAllocationAtomic
        .mockResolvedValueOnce(CLOSED_ROW)
        .mockResolvedValueOnce(CLOSED_ROW);

      const [first, second] = await Promise.all([
        service.closeDailyAllocation('da-1', 700),
        service.closeDailyAllocation('da-1', 700),
      ]);

      expect(first.status).toBe('closed');
      expect(second.status).toBe('closed');
      expect(repo.closeDailyAllocationAtomic).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTodayAllocation', () => {
    it('delegates to the repository with an explicit date string', async () => {
      repo.getDailyAllocationByPlanIdAndDate.mockResolvedValue(OPEN_ROW as any);

      const result = await service.getTodayAllocation('plan-1', '2026-09-16');

      expect(repo.getDailyAllocationByPlanIdAndDate).toHaveBeenCalledWith('plan-1', '2026-09-16');
      expect(result).toEqual(OPEN_ROW);
    });

    it('returns null when no open row exists for the day', async () => {
      repo.getDailyAllocationByPlanIdAndDate.mockResolvedValue(null);

      await expect(service.getTodayAllocation('plan-1', '2026-09-16')).resolves.toBeNull();
    });
  });

  describe('getDailyBudget', () => {
    it('divides reserve_balance by the 30-day heuristic', async () => {
      repo.getPlanById.mockResolvedValue({ id: 'plan-1', reserve_balance: 3000 } as any);

      await expect(service.getDailyBudget('plan-1')).resolves.toBe(100);
    });

    it('falls back to the default daily budget when reserve is empty', async () => {
      repo.getPlanById.mockResolvedValue({ id: 'plan-1', reserve_balance: 0 } as any);

      await expect(service.getDailyBudget('plan-1')).resolves.toBe(1000);
    });
  });
});