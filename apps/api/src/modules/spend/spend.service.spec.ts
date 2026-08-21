import { SpendService } from './spend.service';
import { remainingDaysAfterToday } from '../rollover/rollover-planner';
import { RunwayService } from '../runway/runway.service';
import type { SupabaseRepository } from '../../database/supabase.repository';

const SPENDABLE_POCKET: any = {
  id: 'pocket-1',
  plan_id: 'plan-1',
  name: 'Groceries & food',
  kind: 'spendable',
  category: null,
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 5000,
  daily_cap: null,
  parent_pocket_id: null,
  split_percentage: null,
  repayment_schedule: null,
  loan_provider: null,
  loan_purpose: null,
  due_day: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const SUB_POCKET: any = {
  ...SPENDABLE_POCKET,
  id: 'sub-pocket-1',
  name: 'Snacks',
  parent_pocket_id: 'pocket-1',
  split_percentage: 20,
};

const PARENT_WITH_SUBS: any = {
  ...SPENDABLE_POCKET,
  id: 'pocket-1',
  name: 'Food & Groceries',
};

const FIXED_POCKET: any = {
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
      | 'getActivePlanByUserId'
      | 'updatePocket'
      | 'getIncomeEventsByUserId'
    >
  >;
  let disciplineScore: { applyDelta: jest.Mock };
  let runway: RunwayService;
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
      getSubPocketsByParentId: jest.fn().mockResolvedValue([]),
      getParentReservedBalance: jest.fn().mockResolvedValue(0),
      createImmediateParentToChildReallocation: jest.fn().mockResolvedValue({ id: 'realloc-1' }),
      // Defaults to no active plan (i.e. not on a 'daily' plan) so existing
      // tests, which predate the daily-cap emergency-overspend check, keep
      // exercising the same insufficient_funds/blocked_category paths
      // untouched. Tests for the new daily_cap_exceeded flow override this.
      getActivePlanByUserId: jest.fn().mockResolvedValue(null),
      updatePocket: jest.fn().mockImplementation((id, updates) => ({ id, ...updates })),
      getIncomeEventsByUserId: jest.fn().mockResolvedValue([]),
    } as any;
    disciplineScore = { applyDelta: jest.fn().mockResolvedValue({ previousScore: 100, newScore: 100 }) };
    runway = new RunwayService(repository as unknown as SupabaseRepository);
    service = new SpendService(
      repository as unknown as SupabaseRepository,
      disciplineScore as any,
      runway,
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

  describe('savings guard (prevents spend transactions on savings pockets)', () => {
    const SAVINGS_POCKET = { ...SPENDABLE_POCKET, id: 'pocket-savings', name: 'Emergency Fund', kind: 'savings' as const };

    it('blocks spend attempts on savings pockets regardless of balance', async () => {
      repository.getPocketById.mockResolvedValue(SAVINGS_POCKET as any);
      repository.getPocketSummary.mockResolvedValue(makePocketSummary({ available: 50000 }));

      const result = await service.commitSpend({ pocket_id: 'pocket-savings', amount: 500 }, 'user-1');

      expect(result.allowed).toBe(false);
      expect(result.block_reason).toBe('savings_protected');
      expect(repository.createTransaction).not.toHaveBeenCalled();
    });

    it('blocks spend attempts on savings pockets even with override: true', async () => {
      repository.getPocketById.mockResolvedValue(SAVINGS_POCKET as any);
      repository.getPocketSummary.mockResolvedValue(makePocketSummary({ available: 50000 }));

      const result = await service.commitSpend(
        { pocket_id: 'pocket-savings', amount: 500, override: true, override_reason: 'emergency' },
        'user-1',
      );

      expect(result.allowed).toBe(false);
      expect(result.block_reason).toBe('savings_protected');
      expect(repository.createTransaction).not.toHaveBeenCalled();
      expect(disciplineScore.applyDelta).not.toHaveBeenCalled();
    });

    it('provides clear messaging that savings pockets are protected', async () => {
      repository.getPocketById.mockResolvedValue(SAVINGS_POCKET as any);
      repository.getPocketSummary.mockResolvedValue(makePocketSummary({ available: 50000 }));

      const result = await service.commitSpend({ pocket_id: 'pocket-savings', amount: 500 }, 'user-1');

      expect(result.allowed).toBe(false);
      expect(result.block_reason).toBe('savings_protected');
      expect((result as any).overridable).toBeUndefined();
      expect((result as any).override_points_cost).toBeUndefined();
    });
  });

  describe('savings pockets are never overridable (real banking practice: overdrafts are a designed product, savings is not one)', () => {
    const SAVINGS_POCKET = { ...SPENDABLE_POCKET, id: 'pocket-savings', name: 'Savings', kind: 'savings' as const };

    it('hard-blocks insufficient_funds on an unlocked savings pocket, never reaching overridable', async () => {
      repository.getPocketById.mockResolvedValue(SAVINGS_POCKET as any);
      repository.getPocketSummary.mockResolvedValue(makePocketSummary({ available: 200 }));

      const result = await service.commitSpend({ pocket_id: 'pocket-savings', amount: 500 }, 'user-1');

      expect(result.allowed).toBe(false);
      expect(result.block_reason).toBe('savings_protected');
      expect((result as any).overridable).toBeUndefined();
      expect(repository.createTransaction).not.toHaveBeenCalled();
    });

    it('never overrides savings_protected, even with override: true', async () => {
      repository.getPocketById.mockResolvedValue(SAVINGS_POCKET as any);
      repository.getPocketSummary.mockResolvedValue(makePocketSummary({ available: 200 }));

      const result = await service.commitSpend(
        { pocket_id: 'pocket-savings', amount: 500, override: true },
        'user-1',
      );

      expect(result.allowed).toBe(false);
      expect(result.block_reason).toBe('savings_protected');
      expect(repository.createTransaction).not.toHaveBeenCalled();
      expect(disciplineScore.applyDelta).not.toHaveBeenCalled();
    });

    it('blocks even a savings pocket with ample balance — this is a kind-based rule, not a balance check', async () => {
      repository.getPocketById.mockResolvedValue(SAVINGS_POCKET as any);
      repository.getPocketSummary.mockResolvedValue(makePocketSummary({ available: 50000 }));

      const result = await service.commitSpend({ pocket_id: 'pocket-savings', amount: 500 }, 'user-1');

      expect(result.allowed).toBe(false);
      expect(result.block_reason).toBe('savings_protected');
    });
  });

  describe('insufficient_funds discloses the override point cost up front (real overdraft disclosure practice)', () => {
    it('includes override_points_cost matching what recordEssentialOverride actually deducts', async () => {
      repository.getPocketSummary.mockResolvedValue(makePocketSummary({ available: 200 }));

      const result = await service.commitSpend({ pocket_id: 'pocket-1', amount: 500 }, 'user-1');

      expect(result.allowed).toBe(false);
      expect(result.block_reason).toBe('insufficient_funds');
      expect((result as any).override_points_cost).toBe(10);
    });
  });

  describe('daily_cap_exceeded — emergency overspend on a daily plan', () => {
    const DAILY_POCKET = { ...SPENDABLE_POCKET, daily_cap: 833 };

    beforeEach(() => {
      repository.getPocketById.mockResolvedValue(DAILY_POCKET as any);
      repository.getActivePlanByUserId.mockResolvedValue({ id: 'plan-1', type: 'daily' } as any);
      // 25,000 left in the pocket, nothing spent yet today.
      repository.getPocketSummary.mockResolvedValue(makePocketSummary({ available: 25000 }));
      repository.getSpendTotalsByPocketBetween.mockResolvedValue(new Map());
    });

    it('soft-blocks a spend that fits the balance but blows past today\'s cap', async () => {
      const result = await service.commitSpend({ pocket_id: 'pocket-1', amount: 2000 }, 'user-1');

      expect(result.allowed).toBe(false);
      expect(result.block_reason).toBe('daily_cap_exceeded');
      expect((result as any).current_daily_cap).toBe(833);
      expect((result as any).overridable).toBe(true);
      expect(repository.createTransaction).not.toHaveBeenCalled();
      expect(repository.updatePocket).not.toHaveBeenCalled();
    });

    it('does not block a spend that fits within what is left of today\'s cap', async () => {
      const result = await service.commitSpend({ pocket_id: 'pocket-1', amount: 500 }, 'user-1');

      expect(result.allowed).toBe(true);
      expect(repository.createTransaction).toHaveBeenCalled();
      expect(repository.updatePocket).not.toHaveBeenCalled();
    });

    it('lets the spend through and shrinks the daily cap once the user confirms via override_daily_cap', async () => {
      const result = await service.commitSpend(
        { pocket_id: 'pocket-1', amount: 2000, override_daily_cap: true },
        'user-1',
      );

      expect(result.allowed).toBe(true);
      expect((result as any).overridden_daily_cap).toBe(true);
      expect(repository.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ pocket_id: 'pocket-1', amount: 2000 }),
      );
      // 25,000 - 2,000 = 23,000 left, spread over the days-remaining figure
      // remainingDaysAfterToday computes for "today" (real clock time in
      // this test run) — assert the shape and that it's a sane positive
      // number rather than pinning an exact date-dependent value.
      expect(repository.updatePocket).toHaveBeenCalledWith(
        'pocket-1',
        expect.objectContaining({ daily_cap: expect.any(Number) }),
      );
      const [, updates] = repository.updatePocket.mock.calls[0];
      const daysRemaining = remainingDaysAfterToday(new Date().toISOString().slice(0, 10));
      const expectedCap = Math.round((23000 / Math.max(1, daysRemaining)) * 100) / 100;
      expect((updates as any).daily_cap).toBeCloseTo(expectedCap, 2);
    });

    it('freelancers pace against runwayDays (days to next expected payment), not the calendar month', async () => {
      repository.getActivePlanByUserId.mockResolvedValue({
        id: 'plan-1',
        type: 'daily',
        income_pattern: 'freelancer',
        income_interval_days: 9,
      } as any);
      // Last payment was 6 days ago; the payment before that was 9 days
      // before *that* — a clean 9-day cadence — so runwayDays clamps to
      // 9 - 6 = 3, regardless of what calendar day of the month it is.
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      repository.getIncomeEventsByUserId.mockResolvedValue([
        { date: sixDaysAgo },
        { date: fifteenDaysAgo },
      ] as any);

      const result = await service.commitSpend(
        { pocket_id: 'pocket-1', amount: 2000, override_daily_cap: true },
        'user-1',
      );

      expect(result.allowed).toBe(true);
      const [, updates] = repository.updatePocket.mock.calls[0];
      // 25,000 - 2,000 = 23,000 spread over a 3-day runway, not ~15
      // calendar days -> a much higher (and correct) adjusted cap.
      expect((updates as any).daily_cap).toBeCloseTo(23000 / 3, 2);
    });
  });
});