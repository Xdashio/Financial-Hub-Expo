import { SpendService } from './spend.service';
import type { SupabaseRepository } from '../../database/supabase.repository';

const SPENDABLE_POCKET = {
  id: 'pocket-1',
  plan_id: 'plan-1',
  name: 'Groceries & food',
  kind: 'spendable',
  category: null,
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 5000,
  daily_cap: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const FIXED_POCKET = {
  ...SPENDABLE_POCKET,
  id: 'pocket-fixed',
  name: 'Rent',
  kind: 'fixed',
};

// SPENDABLE_POCKET carries monthly_allocation: 5000, but that field is a
// planning ceiling only — see supabase.repository.ts getPocketSummary.
// Available balance is always ledger-derived, so every test here drives
// balance purely through the getPocketSummary mock, not monthly_allocation
// or getTransactionsByPocketId (spend.service.ts no longer touches that
// directly; it calls repository.getPocketSummary(dto.pocket_id) and reads
// .available — see e9924bb "Ledger balance calculation in repository").
function makePocketSummary(overrides: Partial<{
  allocated: number;
  spent: number;
  available: number;
  transactionCount: number;
  reallocationCount: number;
}> = {}) {
  return {
    allocated: 5000,
    spent: 0,
    available: 5000,
    transactionCount: 0,
    reallocationCount: 0,
    ...overrides,
  };
}

describe('SpendService.commitSpend', () => {
  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      | 'getPocketById'
      | 'getPlanById'
      | 'getPocketSummary'
      | 'getMerchantClassification'
      | 'createTransaction'
      | 'getBehaviorEventsByTypesSince'
      | 'getSpendTotalsByPocketBetween'
      | 'createBehaviorEvent'
      | 'getTopLevelPocketsByPlanId'
    >
  >;
  let disciplineScore: { applyDelta: jest.Mock };
  let service: SpendService;

  beforeEach(() => {
    repository = {
      getPocketById: jest.fn().mockResolvedValue(SPENDABLE_POCKET),
      getPlanById: jest.fn().mockResolvedValue({ id: 'plan-1', user_id: 'user-1' }),
      getPocketSummary: jest.fn().mockResolvedValue(makePocketSummary()),
      getMerchantClassification: jest.fn().mockResolvedValue(null),
      getIdempotencyRecord: jest.fn().mockResolvedValue(null),
      saveIdempotencyRecord: jest.fn().mockResolvedValue({ id: 'idem-1' }),
      createTransaction: jest.fn().mockImplementation((tx) => ({ id: 'tx-1', ...tx })),
      getBehaviorEventsByTypesSince: jest.fn().mockResolvedValue([]),
      getSpendTotalsByPocketBetween: jest.fn().mockResolvedValue(new Map([['pocket-1', 500]])),
      createBehaviorEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue([SPENDABLE_POCKET, FIXED_POCKET]),
    } as any;
    disciplineScore = { applyDelta: jest.fn().mockResolvedValue({ previousScore: 100, newScore: 100 }) };
    service = new SpendService(
      repository as unknown as SupabaseRepository,
      disciplineScore as any,
    );
  });

  it('writes a spend transaction when the check allows it', async () => {
    const result = await service.commitSpend(
      { pocket_id: 'pocket-1', amount: 500, category: 'grocery' },
      'user-1'
    );

    expect(result.allowed).toBe(true);
    expect(repository.createTransaction).toHaveBeenCalledWith({
      pocket_id: 'pocket-1',
      amount: 500,
      type: 'spend',
      merchant: null,
      category: 'grocery',
    });
    expect(result.transaction_id).toBe('tx-1');
  });

  it('does not write a transaction when the amount exceeds available balance', async () => {
    // Ledger-derived available balance is 200 (regardless of the pocket's
    // monthly_allocation ceiling of 5000).
    repository.getPocketSummary.mockResolvedValue(makePocketSummary({ allocated: 5000, spent: 4800, available: 200 }));

    const result = await service.commitSpend({ pocket_id: 'pocket-1', amount: 500 }, 'user-1');

    expect(result.allowed).toBe(false);
    expect(result.block_reason).toBe('insufficient_funds');
    expect(repository.createTransaction).not.toHaveBeenCalled();
  });

  it('does not write a transaction when the category is blocked for the pocket', async () => {
    repository.getPocketById.mockResolvedValue(FIXED_POCKET as any);

    const result = await service.commitSpend(
      { pocket_id: 'pocket-fixed', amount: 500, category: 'gambling_betting' },
      'user-1'
    );

    expect(result.allowed).toBe(false);
    expect(result.block_reason).toBe('blocked_category');
    expect(repository.createTransaction).not.toHaveBeenCalled();
  });

  describe('gambling_betting blocked attempt (option 3, 2026-08-12)', () => {
    it('logs the attempt and deducts discipline score, but still leaves the spend blocked', async () => {
      repository.getPocketById.mockResolvedValue(FIXED_POCKET as any);

      const result = await service.commitSpend(
        { pocket_id: 'pocket-fixed', amount: 500, category: 'gambling_betting', recipient_key: 'Betika' },
        'user-1',
      );

      expect(result.allowed).toBe(false);
      expect(result.block_reason).toBe('blocked_category');
      // The block itself is unaffected — no override, no unblock.
      expect(repository.createTransaction).not.toHaveBeenCalled();
      // But the attempt is logged and costs discipline-score points.
      expect(disciplineScore.applyDelta).toHaveBeenCalledWith('user-1', -5);
      expect(repository.createBehaviorEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          type: 'gambling_blocked_attempt',
          payload: expect.objectContaining({
            pocket_id: 'pocket-fixed',
            category: 'gambling_betting',
            recipient_key: 'Betika',
            amount: 500,
            points_deducted: 5,
          }),
        }),
      );
    });

    it('does not log or deduct points for an ordinary (reviewable) blocked category', async () => {
      // grocery blocked from a housing-scoped fixed pocket — reviewable,
      // not the always-blocked gambling case.
      repository.getPocketById.mockResolvedValue({ ...FIXED_POCKET, category: 'housing' } as any);

      await service.commitSpend(
        { pocket_id: 'pocket-fixed', amount: 500, category: 'grocery' },
        'user-1',
      );

      expect(disciplineScore.applyDelta).not.toHaveBeenCalled();
      expect(repository.createBehaviorEvent).not.toHaveBeenCalled();
    });

    it('caps the monthly point deduction the same way daily-overspend does', async () => {
      repository.getPocketById.mockResolvedValue(FIXED_POCKET as any);
      // Already lost 22 points this month from prior gambling attempts;
      // cap is -25, so only -3 more should apply this time, not the full -5.
      repository.getBehaviorEventsByTypesSince.mockResolvedValue([
        { payload: { points_deducted: 22 } },
      ] as any);

      await service.commitSpend(
        { pocket_id: 'pocket-fixed', amount: 500, category: 'gambling_betting' },
        'user-1',
      );

      expect(disciplineScore.applyDelta).toHaveBeenCalledWith('user-1', -3);
    });
  });

  it('does not write a transaction for an unclassified recipient', async () => {
    const result = await service.commitSpend(
      { pocket_id: 'pocket-1', amount: 500, recipient_key: 'Juma K.' },
      'user-1'
    );

    expect(result.allowed).toBe(false);
    expect(result.block_reason).toBe('unclassified_merchant');
    expect(repository.createTransaction).not.toHaveBeenCalled();
  });

  it('does not write a transaction when the pocket is time-locked, and still reports available balance', async () => {
    const LOCKED_POCKET = {
      ...SPENDABLE_POCKET,
      is_time_locked: true,
      lock_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1hr in the future
    };
    repository.getPocketById.mockResolvedValue(LOCKED_POCKET as any);
    repository.getPocketSummary.mockResolvedValue(makePocketSummary({ available: 3000 }));

    const result = await service.commitSpend({ pocket_id: 'pocket-1', amount: 500 }, 'user-1');

    expect(result.allowed).toBe(false);
    expect(result.block_reason).toBe('pocket_time_locked');
    expect(result.pocket.available_balance).toBe(3000);
    expect(repository.createTransaction).not.toHaveBeenCalled();
  });

  describe('insufficient_funds override (audit_team.md item 4/5)', () => {
    const OTHER_POCKET = { ...SPENDABLE_POCKET, id: 'pocket-2', name: 'Transport' };

    beforeEach(() => {
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SPENDABLE_POCKET, OTHER_POCKET, FIXED_POCKET] as any);
      // Source pocket (pocket-1) is short; the sibling (pocket-2) has room.
      repository.getPocketSummary.mockImplementation(async (id: string) => {
        if (id === 'pocket-1') return makePocketSummary({ available: 200 });
        if (id === 'pocket-2') return makePocketSummary({ available: 900 });
        return makePocketSummary({ available: 0 });
      });
    });

    it('reports shortfall, overridable, and reallocation sources without writing a transaction', async () => {
      const result = await service.commitSpend({ pocket_id: 'pocket-1', amount: 500 }, 'user-1');

      expect(result.allowed).toBe(false);
      expect(result.block_reason).toBe('insufficient_funds');
      expect(result.shortfall).toBe(300);
      expect(result.overridable).toBe(true);
      expect(result.reallocation_sources).toEqual([
        { pocket_id: 'pocket-2', pocket_name: 'Transport', available_balance: 900 },
      ]);
      expect(repository.createTransaction).not.toHaveBeenCalled();
    });

    it('excludes the source pocket, zero-balance pockets, and locked pockets from reallocation sources', async () => {
      const LOCKED_SIBLING = { ...SPENDABLE_POCKET, id: 'pocket-3', name: 'Savings', is_time_locked: true, lock_until: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
      repository.getTopLevelPocketsByPlanId.mockResolvedValue([SPENDABLE_POCKET, OTHER_POCKET, FIXED_POCKET, LOCKED_SIBLING] as any);
      repository.getPocketSummary.mockImplementation(async (id: string) => {
        if (id === 'pocket-1') return makePocketSummary({ available: 200 });
        if (id === 'pocket-2') return makePocketSummary({ available: 900 });
        if (id === 'pocket-3') return makePocketSummary({ available: 5000 }); // locked — must not appear
        return makePocketSummary({ available: 0 }); // pocket-fixed — zero balance, must not appear
      });

      const result = await service.commitSpend({ pocket_id: 'pocket-1', amount: 500 }, 'user-1');

      expect(result.reallocation_sources).toEqual([
        { pocket_id: 'pocket-2', pocket_name: 'Transport', available_balance: 900 },
      ]);
    });

    it('writes the transaction and logs essential_override when the client resubmits with override: true', async () => {
      const result = await service.commitSpend(
        { pocket_id: 'pocket-1', amount: 500, override: true, override_reason: 'car broke down' },
        'user-1',
      );

      expect(result.allowed).toBe(true);
      expect(result.block_reason).toBeNull();
      expect((result as any).overridden).toBe(true);
      expect(repository.createTransaction).toHaveBeenCalledWith({
        pocket_id: 'pocket-1',
        amount: 500,
        type: 'spend',
        merchant: null,
        category: null,
      });
      expect(repository.createBehaviorEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          type: 'essential_override',
          payload: expect.objectContaining({
            pocket_id: 'pocket-1',
            amount: 500,
            shortfall: 300,
            reason: 'car broke down',
            points_deducted: 10,
          }),
        }),
      );
      expect(disciplineScore.applyDelta).toHaveBeenCalledWith('user-1', -10);
    });

    it('never overrides blocked_category or pocket_time_locked, even with override: true', async () => {
      repository.getPocketById.mockResolvedValue(FIXED_POCKET as any);
      repository.getPocketSummary.mockImplementation(async () => makePocketSummary({ available: 5000 }));

      const result = await service.commitSpend(
        { pocket_id: 'pocket-fixed', amount: 500, category: 'gambling_betting', override: true },
        'user-1',
      );

      expect(result.allowed).toBe(false);
      expect(result.block_reason).toBe('blocked_category');
      expect(repository.createTransaction).not.toHaveBeenCalled();
    });

    it('caps essential_override deductions per calendar month like the other penalty events', async () => {
      repository.getBehaviorEventsByTypesSince.mockResolvedValue([
        { payload: { points_deducted: 10 } },
        { payload: { points_deducted: 10 } },
        { payload: { points_deducted: 8 } },
      ] as any);

      await service.commitSpend(
        { pocket_id: 'pocket-1', amount: 500, override: true },
        'user-1',
      );

      // Already -28 for the month; cap is -30, so only -2 more can apply.
      expect(disciplineScore.applyDelta).toHaveBeenCalledWith('user-1', -2);
    });
  });
});