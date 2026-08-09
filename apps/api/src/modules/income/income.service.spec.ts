import { BadRequestException } from '@nestjs/common';
import { IncomeService } from './income.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
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
    const service = new IncomeService(repository);

    await expect(service.createManualIncome(BASE_DTO, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the plan has no pockets', async () => {
    const repository = makeRepository({ getPocketsByPlanId: jest.fn().mockResolvedValue([]) });
    const service = new IncomeService(repository);

    await expect(service.createManualIncome(BASE_DTO, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates the income event regardless of run_allocation', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository);

    await service.createManualIncome({ ...BASE_DTO, run_allocation: false }, 'user-1');

    expect(repository.createIncomeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', amount: 4000, source: 'client_payment', run_allocation: false })
    );
  });

  it('does not touch pocket balances when run_allocation is false', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository);

    const result = await service.createManualIncome({ ...BASE_DTO, run_allocation: false }, 'user-1');

    expect(repository.updatePocket).not.toHaveBeenCalled();
    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(result.allocation.triggered).toBe(false);
  });

  it('splits income across pockets by their proportional share (C5 fix)', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository);

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
    const service = new IncomeService(repository);

    const result = await service.createManualIncome(BASE_DTO, 'user-1');

    // Regression guard: calling supabase-js .insert([]) with a zero-row
    // array is what produced the opaque 500 on POST /income/manual.
    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(result.allocation.triggered).toBe(true);
    expect(result.allocation.allocations).toEqual([]);
  });

  it('still creates ledger transactions for the allocation event', async () => {
    const repository = makeRepository();
    const service = new IncomeService(repository);

    await service.createManualIncome(BASE_DTO, 'user-1');

    expect(repository.createTransactions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ pocket_id: 'pocket-savings', type: 'allocation' }),
        expect.objectContaining({ pocket_id: 'pocket-food', type: 'allocation' }),
      ])
    );
  });
});