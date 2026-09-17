import { BadRequestException, HttpException, HttpStatus, NotFoundException, ConflictException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { OnboardingInput, MsmeOnboardingInput } from '@financial-hub/shared';
import { MIN_SAVINGS_RATE } from './rules-engine';

function makeRepository(overrides: Partial<jest.Mocked<SupabaseRepository>> = {}) {
  return {
    deactivateUserPlans: jest.fn().mockResolvedValue(undefined),
    deactivateUserPlansBySegment: jest.fn().mockResolvedValue(undefined),
    deactivateUserPlansExcept: jest.fn().mockResolvedValue(undefined),
    createPlan: jest.fn().mockImplementation((plan) => ({ ...plan })),
    updatePlan: jest.fn().mockImplementation((id, updates) => ({ id, ...updates })),
    createPockets: jest.fn().mockImplementation((pockets) => pockets),
    createFixedExpense: jest.fn().mockResolvedValue({ id: 'fe-1' }),
    deleteFixedExpensesByUserId: jest.fn().mockResolvedValue(undefined),
    createTransactions: jest.fn().mockResolvedValue([]),
    createBehaviorEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
    // Mirrors migration 036 atomic_commit_onboarding: returns the persisted
    // plan id and the pockets exactly as the RPC returns them.
    commitOnboardingAtomic: jest.fn().mockImplementation(async (input) => ({
      plan_id: input.plan.id,
      pockets: (input.pockets ?? []).map((p: any, i: number) => ({
        id: p.id ?? `pocket-${i}`,
        name: p.name,
        kind: p.kind,
        category: p.category ?? null,
        monthly_allocation: p.monthly_allocation ?? 0,
        daily_cap: p.daily_cap ?? null,
      })),
    })),
    // Mirrors migration 043 atomic_retake_plan.
    retakePlanAtomic: jest.fn().mockImplementation(async (input) => ({
      ok: true as const,
      result: {
        plan_id: input.plan.id,
        pockets: (input.pockets ?? []).map((p: any, i: number) => ({
          id: p.id ?? `pocket-${i}`,
          name: p.name,
          kind: p.kind,
          category: p.category ?? null,
          monthly_allocation: p.monthly_allocation ?? 0,
          daily_cap: p.daily_cap ?? null,
        })),
      },
    })),
    getActivePlanByUserId: jest.fn().mockResolvedValue(null),
    getPocketsByPlanId: jest.fn().mockResolvedValue([]),
    getPocketSummary: jest.fn().mockResolvedValue({ available: 0, allocated: 0, spent: 0, transactionCount: 0, reallocationCount: 0 }),
    getBehaviorEventsByUserId: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as jest.Mocked<SupabaseRepository>;
}

const SALARIED_TRACKER_INPUT: OnboardingInput = {
  incomePattern: 'salaried',
  spendingHabit: 'tracker',
  incomeAmount: 50000,
  fixedTotal: 15000, // remaining 35000, 20% of income = 10000, so 'structured' applies
  sourceCount: 1,
};

const FREELANCER_WEEK3_INPUT: OnboardingInput = {
  incomePattern: 'freelancer',
  spendingHabit: 'week3',
  incomeAmount: 40000,
  fixedTotal: 10000,
  sourceCount: 3,
  // Required for freelancer plans — see rules-engine.ts
  // validateOnboardingInput and docs/FREELANCER_RUNWAY.md.
  incomeIntervalBand: 'biweekly',
};

describe('OnboardingService.assign', () => {
  let service: OnboardingService;

  beforeEach(() => {
    service = new OnboardingService(makeRepository());
  });

  it('rejects input that fails schema validation, without evaluating rules', () => {
    expect(() => service.assign({ incomeAmount: 'not-a-number' })).toThrow(BadRequestException);
  });

  it('rejects input that fails domain validation (fixed expenses >= income)', () => {
    expect(() =>
      service.assign({
        incomePattern: 'salaried',
        spendingHabit: 'tracker',
        incomeAmount: 10000,
        fixedTotal: 10000,
        sourceCount: 1,
      })
    ).toThrow(BadRequestException);
  });

  it('assigns a structured, salaried plan for a tracker with healthy margin after fixed costs', () => {
    const result = service.assign(SALARIED_TRACKER_INPUT);

    expect(result.planType).toBe('structured');
    expect(result.incomePattern).toBe('salaried');
    expect(result.remainingAfterFixed).toBe(35000);
    expect(result.savingsTarget).toBeCloseTo(5000); // 10% of gross income (50000 * 0.10)
    expect(result.spendableAmount).toBeCloseTo(30000);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('assigns a daily-budget plan for a "runs low by week 3" spender, regardless of margin', () => {
    const result = service.assign(FREELANCER_WEEK3_INPUT);

    expect(result.planType).toBe('daily');
    expect(result.incomePattern).toBe('freelancer');
  });

  it('treats a "mix" income pattern as salaried for plan stability', () => {
    const result = service.assign({ ...SALARIED_TRACKER_INPUT, incomePattern: 'mix' });

    expect(result.incomePattern).toBe('salaried');
  });

  it('assigns daily budget when needs ratio is high (≥70% of income in fixed costs)', () => {
    const result = service.assign({
      incomePattern: 'salaried',
      spendingHabit: 'tracker',
      incomeAmount: 50000,
      fixedTotal: 45000, // needs ratio 90% → high band → daily
      sourceCount: 1,
    });

    expect(result.planType).toBe('daily');
    expect(result.needsBand).toBe('high');
  });
});

describe('OnboardingService.previewPlan', () => {
  let service: OnboardingService;

  beforeEach(() => {
    service = new OnboardingService(makeRepository());
  });

  it('returns the same assign() fields plus a categoryBreakdown that sums to spendableAmount', () => {
    const result = service.previewPlan(SALARIED_TRACKER_INPUT);

    expect(result.planType).toBe('structured');
    expect(result.spendableAmount).toBeCloseTo(30000);
    const total = result.categoryBreakdown.reduce((sum, c) => sum + c.amount, 0);
    expect(total).toBeCloseTo(result.spendableAmount);
  });

  it('echoes back the default weighting as categoryPercentages when no override is given', () => {
    const result = service.previewPlan(SALARIED_TRACKER_INPUT);
    expect(result.categoryPercentages.food).toBeCloseTo(42.86, 1);
  });

  it('uses a valid user override to compute the breakdown instead of default weights', () => {
    const result = service.previewPlan({
      ...SALARIED_TRACKER_INPUT,
      categoryPercentages: { food: 50, transport: 30, leisure: 20 },
    });
    const food = result.categoryBreakdown.find((c) => c.category === 'food')!;
    expect(food.percentage).toBeCloseTo(50, 0);
    expect(result.categoryPercentages.food).toBe(50);
  });

  it('rejects an override that does not sum to 100', () => {
    expect(() =>
      service.previewPlan({
        ...SALARIED_TRACKER_INPUT,
        categoryPercentages: { food: 50, transport: 30, leisure: 10 },
      })
    ).toThrow(BadRequestException);
  });

  it('rejects an override missing a category this persona requires', () => {
    expect(() =>
      service.previewPlan({
        ...SALARIED_TRACKER_INPUT,
        categoryPercentages: { food: 60, transport: 40 },
      })
    ).toThrow(BadRequestException);
  });

  it('is a dry run — never touches the repository', () => {
    const repo = makeRepository();
    const dryRunService = new OnboardingService(repo);
    dryRunService.previewPlan(SALARIED_TRACKER_INPUT);
    expect(repo.createPlan).not.toHaveBeenCalled();
    expect(repo.createPockets).not.toHaveBeenCalled();
  });
});

describe('OnboardingService.commit', () => {
  let repository: ReturnType<typeof makeRepository>;
  let service: OnboardingService;

  beforeEach(() => {
    repository = makeRepository();
    service = new OnboardingService(repository);
  });

  it('rejects invalid input without touching the repository', async () => {
    await expect(service.commit({ incomeAmount: -1 }, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.commitOnboardingAtomic).not.toHaveBeenCalled();
  });

  it('persists plan + pockets through the atomic RPC (deactivation is inside the transaction)', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    expect(repository.commitOnboardingAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        segment: 'individual',
        plan: expect.objectContaining({
          status: 'active',
          money_personality: 'saver',
          type: 'structured',
        }),
      })
    );
    // The deactivate happens inside atomic_commit_onboarding, not as a
    // separate repository call that could leave a plan-less window.
    expect(repository.deactivateUserPlansBySegment).not.toHaveBeenCalled();
    expect(repository.createPlan).not.toHaveBeenCalled();
    expect(repository.createPockets).not.toHaveBeenCalled();
  });

  it('maps a "mix" income pattern to "salaried" when persisting the plan', async () => {
    await service.commit({ ...SALARIED_TRACKER_INPUT, incomePattern: 'mix' }, 'user-1');

    expect(repository.commitOnboardingAtomic.mock.calls[0][0].plan.income_pattern).toBe('salaried');
    expect(repository.commitOnboardingAtomic.mock.calls[0][0])
      .toEqual(expect.objectContaining({ userId: 'user-1', segment: 'individual' }));
  });

  it('creates a Fixed Expenses pocket, a locked Savings pocket, and evenly-split spendable pockets for a structured plan', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    const pockets = repository.commitOnboardingAtomic.mock.calls[0][0].pockets;
    const kinds = pockets.map((p: any) => p.kind);
    expect(kinds).toEqual(['fixed', 'savings', 'spendable', 'spendable', 'spendable']);

    const fixedPocket = pockets.find((p: any) => p.kind === 'fixed');
    expect(fixedPocket).toBeDefined();
    expect(fixedPocket!.monthly_allocation).toBe(SALARIED_TRACKER_INPUT.fixedTotal);

    const savingsPocket = pockets.find((p: any) => p.kind === 'savings');
    expect(savingsPocket).toBeDefined();
    expect(savingsPocket!.is_time_locked).toBe(true);
    expect(savingsPocket!.lock_until).toBeTruthy();

    const spendablePockets = pockets.filter((p: any) => p.kind === 'spendable');
    expect(spendablePockets.every((p: any) => p.daily_cap === null)).toBe(true);
    const categories = spendablePockets.map((p: any) => p.category).sort();
    expect(categories).toEqual(['food', 'leisure', 'transport']);

    // Structured plans divide the spendable amount across weighted categories.
    const total = spendablePockets.reduce((sum: number, p: any) => sum + p.monthly_allocation, 0);
    const assignment = service.assign(SALARIED_TRACKER_INPUT);
    expect(total).toBeCloseTo(assignment.spendableAmount);
  });

  it('sets a daily_cap on spendable pockets for a daily-budget plan', async () => {
    await service.commit(FREELANCER_WEEK3_INPUT, 'user-1');

    const pockets = repository.commitOnboardingAtomic.mock.calls[0][0].pockets;
    const spendablePockets = pockets.filter((p: any) => p.kind === 'spendable');
    expect(spendablePockets.every((p: any) => typeof p.daily_cap === 'number' && p.daily_cap > 0)).toBe(true);
  });

  it('applies a user-edited categoryPercentages split to the committed spendable pockets', async () => {
    await service.commit(
      { ...SALARIED_TRACKER_INPUT, categoryPercentages: { food: 50, transport: 30, leisure: 20 } },
      'user-1',
    );

    const pockets = repository.commitOnboardingAtomic.mock.calls[0][0].pockets;
    const spendablePockets = pockets.filter((p: any) => p.kind === 'spendable');
    const assignment = service.assign(SALARIED_TRACKER_INPUT);
    const food = spendablePockets.find((p: any) => p.category === 'food');
    expect(food!.monthly_allocation).toBeCloseTo(assignment.spendableAmount * 0.5);
  });

  it('rejects commit when categoryPercentages does not sum to 100', async () => {
    await expect(
      service.commit(
        { ...SALARIED_TRACKER_INPUT, categoryPercentages: { food: 50, transport: 30, leisure: 10 } },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.commitOnboardingAtomic).not.toHaveBeenCalled();
  });

  it('creates one locked fixed pocket per submitted fixed expense (itemized, not lumped)', async () => {
    const input: OnboardingInput = {
      ...SALARIED_TRACKER_INPUT,
      fixedExpenses: [
        { name: 'Rent', amount: 10000, dueDay: 1, category: 'housing' },
        { name: 'Internet', amount: 2000, dueDay: 5, category: 'utilities' },
      ],
      fixedTotal: 12000,
    };

    await service.commit(input, 'user-1');

    const pockets = repository.commitOnboardingAtomic.mock.calls[0][0].pockets;
    const fixed = pockets.filter((p: any) => p.kind === 'fixed');
    expect(fixed).toHaveLength(2);
    expect(fixed.every((p: any) => p.is_time_locked && p.lock_until)).toBe(true);
    expect(fixed.map((p: any) => p.name).sort()).toEqual(['Internet', 'Rent']);
  });

  it('adds a Family spendable pocket when hasDependents is set', async () => {
    await service.commit({ ...SALARIED_TRACKER_INPUT, hasDependents: true }, 'user-1');

    const pockets = repository.commitOnboardingAtomic.mock.calls[0][0].pockets;
    const categories = pockets
      .filter((p: any) => p.kind === 'spendable')
      .map((p: any) => p.category)
      .sort();
    expect(categories).toEqual(['family', 'food', 'leisure', 'transport']);
  });

  it('passes the submitted fixed expenses to the RPC for insertion', async () => {
    const input: OnboardingInput = {
      ...SALARIED_TRACKER_INPUT,
      fixedExpenses: [
        { name: 'Rent', amount: 10000, dueDay: 1, category: 'utilities' },
        { name: 'Internet', amount: 2000, dueDay: 5, category: 'transport' },
      ],
    };

    await service.commit(input, 'user-1');

    const call = repository.commitOnboardingAtomic.mock.calls[0][0];
    expect(call.replaceFixedExpenses).toBe(true);
    expect(call.fixedExpenses).toEqual([
      { name: 'Rent', amount: 10000, due_day: 1, category: 'utilities' },
      { name: 'Internet', amount: 2000, due_day: 5, category: 'transport' },
    ]);
    expect(repository.createFixedExpense).not.toHaveBeenCalled();
  });

  it('creates no fixed expense rows when none were submitted', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    expect(repository.commitOnboardingAtomic.mock.calls[0][0].replaceFixedExpenses).toBe(false);
    expect(repository.commitOnboardingAtomic.mock.calls[0][0].fixedExpenses).toEqual([]);
    expect(repository.createFixedExpense).not.toHaveBeenCalled();
    expect(repository.deleteFixedExpensesByUserId).not.toHaveBeenCalled();
  });

  // Regression test for the duplication bug: retake-checkin.tsx prefills
  // the form with the user's *existing* fixed expenses, then resubmits
  // that full list on save. Without clearing first, every retake
  // re-inserted the same rows on top of what was already there (visibly,
  // "Electricity" appearing 5x after a few retakes). commit() must give
  // full-replace semantics whenever fixedExpenses is provided at all — the
  // RPC deletes the segment's rows then inserts the submitted set in one
  // transaction.
  it('clears existing fixed expenses before inserting the submitted set (full replace, not append)', async () => {
    const input: OnboardingInput = {
      ...SALARIED_TRACKER_INPUT,
      fixedExpenses: [{ name: 'Rent', amount: 10000, dueDay: 1, category: 'utilities' }],
    };

    await service.commit(input, 'user-1');

    expect(repository.commitOnboardingAtomic.mock.calls[0][0].replaceFixedExpenses).toBe(true);
    expect(repository.commitOnboardingAtomic.mock.calls[0][0].fixedExpenses).toEqual([
      { name: 'Rent', amount: 10000, due_day: 1, category: 'utilities' },
    ]);
    expect(repository.createFixedExpense).not.toHaveBeenCalled();
  });

  it('clears existing fixed expenses when an explicit empty array is submitted', async () => {
    const input: OnboardingInput = { ...SALARIED_TRACKER_INPUT, fixedExpenses: [] };

    await service.commit(input, 'user-1');

    expect(repository.commitOnboardingAtomic.mock.calls[0][0].replaceFixedExpenses).toBe(true);
    expect(repository.commitOnboardingAtomic.mock.calls[0][0].fixedExpenses).toEqual([]);
    expect(repository.createFixedExpense).not.toHaveBeenCalled();
  });

  it('leaves existing fixed expenses untouched when the field is omitted entirely', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    expect(repository.commitOnboardingAtomic.mock.calls[0][0].replaceFixedExpenses).toBe(false);
    expect(repository.deleteFixedExpensesByUserId).not.toHaveBeenCalled();
    expect(repository.createFixedExpense).not.toHaveBeenCalled();
  });

  // As of e9924bb ("Fix Phantom money at onboarding"), onboarding no longer
  // writes allocation transactions itself. monthly_allocation on the created
  // pockets is a planning ceiling only; real ledger money only lands when
  // the user logs an actual income event (see IncomeService.allocateIncome),
  // which is what previously double-counted against the onboarding figure.
  it('does not write allocation transactions at onboarding time — monthly_allocation is a planning ceiling only', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    expect(repository.createTransactions).not.toHaveBeenCalled();
  });

  it('logs a plan_created behavior event inside the RPC transaction', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    const call = repository.commitOnboardingAtomic.mock.calls[0][0];
    expect(call.behaviorType).toBe('plan_created');
    expect(call.behaviorPayload).toEqual(
      expect.objectContaining({ planType: 'structured', incomePattern: 'salaried' })
    );
    // The event is written by the RPC, not as a separate service call.
    expect(repository.createBehaviorEvent).not.toHaveBeenCalled();
  });

  it('maps an RPC rejection (race loser / failed persist) to a clean conflict', async () => {
    repository.commitOnboardingAtomic.mockResolvedValue(null);

    await expect(service.commit(SALARIED_TRACKER_INPUT, 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createPlan).not.toHaveBeenCalled();
    expect(repository.createPockets).not.toHaveBeenCalled();
  });

  it('returns a planId and the created pockets mapped to the public shape', async () => {
    const result = await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    expect(typeof result.planId).toBe('string');
    expect(result.planId.length).toBeGreaterThan(0);
    expect(result.pockets).toHaveLength(5);
    for (const pocket of result.pockets) {
      expect(pocket).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          kind: expect.any(String),
          monthlyAllocation: expect.any(Number),
        })
      );
    }
  });

  it('serializes concurrent commits — the loser is rejected with a clean conflict and no partial plan is written', async () => {
    repository.commitOnboardingAtomic
      .mockResolvedValueOnce({ plan_id: 'plan-1', pockets: [] })
      .mockResolvedValueOnce(null);

    const [winner, loser] = await Promise.allSettled([
      service.commit(SALARIED_TRACKER_INPUT, 'user-1'),
      service.commit(SALARIED_TRACKER_INPUT, 'user-1'),
    ]);

    expect(winner.status).toBe('fulfilled');
    expect(loser.status).toBe('rejected');
    if (loser.status === 'rejected') {
      expect(loser.reason).toBeInstanceOf(ConflictException);
    }
    expect(repository.createPlan).not.toHaveBeenCalled();
    expect(repository.createPockets).not.toHaveBeenCalled();
  });
});

describe('OnboardingService.retake', () => {
  let repository: ReturnType<typeof makeRepository>;
  let service: OnboardingService;

  const previousPockets = [
    { id: 'old-food', name: 'Food & Groceries', kind: 'spendable', category: 'food', monthly_allocation: 10000 },
    { id: 'old-save', name: 'Savings', kind: 'savings', category: null, monthly_allocation: 3500 },
    { id: 'old-fixed', name: 'Fixed Expenses', kind: 'fixed', category: null, monthly_allocation: 15000 },
  ];

  beforeEach(() => {
    repository = makeRepository({
      getActivePlanByUserId: jest.fn().mockResolvedValue({ id: 'plan-old', type: 'structured', user_id: 'user-1' }),
      getPocketsByPlanId: jest.fn().mockResolvedValue(previousPockets),
      getPocketSummary: jest.fn().mockImplementation(async (pocketId: string) => {
        const balances: Record<string, number> = {
          'old-food': 400,
          'old-save': 1000,
          'old-fixed': 200,
        };
        return { available: balances[pocketId] ?? 0, allocated: 0, spent: 0, transactionCount: 0, reallocationCount: 0 };
      }),
      getBehaviorEventsByUserId: jest.fn().mockResolvedValue([]),
    });
    service = new OnboardingService(repository);
  });

  it('rejects when the user already retaken this UTC month', async () => {
    repository.getBehaviorEventsByUserId.mockResolvedValue([
      { id: 'e1', user_id: 'user-1', type: 'plan_retaken', payload: {}, created_at: new Date().toISOString() },
    ] as any);

    try {
      await service.retake(SALARIED_TRACKER_INPUT, 'user-1');
      fail('expected HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    expect(repository.retakePlanAtomic).not.toHaveBeenCalled();
  });

  it('rejects when there is no active plan', async () => {
    repository.getActivePlanByUserId.mockResolvedValue(null);

    await expect(service.retake(SALARIED_TRACKER_INPUT, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('migrates balances onto the new pockets and conserves total money via atomic_retake_plan (043)', async () => {
    const result = await service.retake(SALARIED_TRACKER_INPUT, 'user-1');

    expect(result.redistribution.totalMoved).toBeCloseTo(1600);
    expect(result.redistribution.previousPlanType).toBe('structured');
    expect(result.redistribution.newPlanType).toBe('structured');
    expect(result.redistribution.movements.length).toBeGreaterThan(0);

    expect(repository.retakePlanAtomic).toHaveBeenCalledTimes(1);
    const call = repository.retakePlanAtomic.mock.calls[0][0];
    expect(call.previousPlanId).toBe('plan-old');
    expect(call.segment).toBe('individual');
    expect(call.behaviorPayload).toEqual(
      expect.objectContaining({
        previousPlanId: 'plan-old',
        totalMoved: expect.any(Number),
      }),
    );
    expect(call.behaviorPayload.totalMoved).toBeCloseTo(1600);

    const ledger = call.ledger;
    const credited = ledger
      .filter((t: any) => t.type === 'reallocation_in')
      .reduce((s: number, t: any) => s + t.amount, 0);
    const debited = ledger
      .filter((t: any) => t.type === 'reallocation_out')
      .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
    expect(credited).toBeCloseTo(1600);
    expect(debited).toBeCloseTo(1600);

    // Persist path is the RPC — no sequential deactivate/create/ledger calls.
    expect(repository.deactivateUserPlansBySegment).not.toHaveBeenCalled();
    expect(repository.createPlan).not.toHaveBeenCalled();
    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(repository.createBehaviorEvent).not.toHaveBeenCalled();
  });

  it('maps an RPC monthly-limit rejection to 429 (concurrent retake loser)', async () => {
    repository.retakePlanAtomic.mockResolvedValue({ ok: false, reason: 'monthly_limit' });

    try {
      await service.retake(SALARIED_TRACKER_INPUT, 'user-1');
      fail('expected HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('maps an under-lock insufficient source balance to ConflictException', async () => {
    repository.retakePlanAtomic.mockResolvedValue({ ok: false, reason: 'insufficient' });

    await expect(service.retake(SALARIED_TRACKER_INPUT, 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a generic RPC conflict to ConflictException (no stale reactivate path)', async () => {
    repository.retakePlanAtomic.mockResolvedValue({ ok: false, reason: 'conflict' });

    await expect(service.retake(SALARIED_TRACKER_INPUT, 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(repository.updatePlan).not.toHaveBeenCalled();
  });

  it('serializes concurrent retakes — exactly one winner, loser gets 429', async () => {
    repository.retakePlanAtomic
      .mockResolvedValueOnce({
        ok: true,
        result: {
          plan_id: 'plan-new',
          pockets: [{ id: 'p1', name: 'Savings', kind: 'savings', category: null, monthly_allocation: 0, daily_cap: null }],
        },
      })
      .mockResolvedValueOnce({ ok: false, reason: 'monthly_limit' });

    const [winner, loser] = await Promise.allSettled([
      service.retake(SALARIED_TRACKER_INPUT, 'user-1'),
      service.retake(SALARIED_TRACKER_INPUT, 'user-1'),
    ]);

    expect(winner.status).toBe('fulfilled');
    expect(loser.status).toBe('rejected');
    if (loser.status === 'rejected') {
      expect(loser.reason).toBeInstanceOf(HttpException);
      expect((loser.reason as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    expect(repository.retakePlanAtomic).toHaveBeenCalledTimes(2);
  });

  it('still creates a redistribution summary with zero total when pockets are empty', async () => {
    repository.getPocketSummary.mockResolvedValue({
      available: 0,
      allocated: 0,
      spent: 0,
      transactionCount: 0,
      reallocationCount: 0,
    });

    const result = await service.retake(SALARIED_TRACKER_INPUT, 'user-1');

    expect(result.redistribution.totalMoved).toBe(0);
    expect(result.redistribution.movements).toEqual([]);
    expect(repository.retakePlanAtomic.mock.calls[0][0].ledger).toEqual([]);
  });

  it('getRetakeEligibility reports allowed when no prior retake exists', async () => {
    const eligibility = await service.getRetakeEligibility('user-1');
    expect(eligibility).toEqual({
      allowed: true,
      nextRetakeAvailableOn: null,
      lastRetakenAt: null,
    });
  });
});

// ============================================================================
// MSME segment onboarding (ADR-001 / MSME_PHASED_BUILD_PLAN §6.2)
// ============================================================================

const MSME_INPUT: MsmeOnboardingInput = {
  segment: 'msme',
  businessName: 'Duka Kool',
  monthlyRevenue: 100000,
  fixedTotal: 30000, // remaining 70000, savings floor 10% of gross = 10000
  hasEmployees: true,
};

describe('OnboardingService.assignMsme', () => {
  let service: OnboardingService;

  beforeEach(() => {
    service = new OnboardingService(makeRepository());
  });

  it('returns a structured plan flagged with segment msme', () => {
    const result = service.assignMsme(MSME_INPUT);

    expect(result.segment).toBe('msme');
    expect(result.plan).toBe('Business — Structured');
    expect(result.planType).toBe('structured');
    expect(result.incomePattern).toBe('salaried');
    expect(result.remainingAfterFixed).toBe(70000);
  });

  it('applies the MIN_SAVINGS_RATE 10% floor against gross monthly revenue', () => {
    const result = service.assignMsme(MSME_INPUT);

    expect(result.savingsTarget).toBeCloseTo(MSME_INPUT.monthlyRevenue * MIN_SAVINGS_RATE);
    expect(result.spendableAmount).toBeCloseTo(70000 - 10000);
  });

  it('rejects fixed total >= monthly revenue', () => {
    expect(() =>
      service.assignMsme({ ...MSME_INPUT, fixedTotal: 100000 })
    ).toThrow(BadRequestException);
  });

  it('rejects non-positive monthly revenue', () => {
    expect(() =>
      service.assignMsme({ ...MSME_INPUT, monthlyRevenue: 0 })
    ).toThrow(BadRequestException);
  });
});

describe('OnboardingService.commitMsme', () => {
  let repository: ReturnType<typeof makeRepository>;
  let service: OnboardingService;

  beforeEach(() => {
    repository = makeRepository();
    service = new OnboardingService(repository);
  });

  it('persists the MSME plan through the atomic RPC (segment-scoped, leaves the individual plan untouched)', async () => {
    await service.commitMsme(MSME_INPUT, 'user-1');

    const call = repository.commitOnboardingAtomic.mock.calls[0][0];
    expect(call.segment).toBe('msme');
    expect(call.userId).toBe('user-1');
    expect(call.plan).toEqual(
      expect.objectContaining({
        type: 'structured',
        income_pattern: 'salaried',
        expected_income_amount: 100000,
        status: 'active',
        money_personality: 'saver',
      })
    );
    // Deactivation + persistence happen inside atomic_commit_onboarding, so
    // no separate segment-scoped deactivate call is made from the service.
    expect(repository.deactivateUserPlansBySegment).not.toHaveBeenCalled();
    expect(repository.deactivateUserPlans).not.toHaveBeenCalled();
    expect(repository.createPlan).not.toHaveBeenCalled();
  });

  it('builds the MSME pocket set: fixed expenses (itemized) + locked Savings + spendable custom pockets', async () => {
    const input: MsmeOnboardingInput = {
      ...MSME_INPUT,
      fixedTotal: 30000,
      customPockets: [
        { name: 'Stock', category: 'stock' },
        { name: 'Suppliers', category: 'supplier' },
        { name: 'Licences', category: 'licence' },
        { name: 'Profit', category: 'profit' },
      ],
    };

    await service.commitMsme(input, 'user-1');

    const pockets = repository.commitOnboardingAtomic.mock.calls[0][0].pockets;
    const kinds = pockets.map((p: any) => p.kind);
    expect(kinds).toEqual(['fixed', 'savings', 'spendable', 'spendable', 'spendable', 'spendable']);

    const lumpFixed = pockets.find((p: any) => p.kind === 'fixed');
    expect(lumpFixed!.name).toBe('Fixed Expenses');
    expect(lumpFixed!.monthly_allocation).toBe(30000);

    const savingsPocket = pockets.find((p: any) => p.kind === 'savings');
    expect(savingsPocket!.is_time_locked).toBe(true);
    expect(savingsPocket!.monthly_allocation).toBeCloseTo(10000);

    const spendablePockets = pockets.filter((p: any) => p.kind === 'spendable');
    expect(spendablePockets.map((p: any) => p.category).sort()).toEqual(['licence', 'profit', 'stock', 'supplier']);
    const total = spendablePockets.reduce((s: number, p: any) => s + p.monthly_allocation, 0);
    expect(total).toBeCloseTo(60000);
    // Even split across the four custom pockets.
    expect(spendablePockets[0].monthly_allocation).toBeCloseTo(15000);
  });

  it('accepts business fixed-expense categories in itemized fixed pockets', async () => {
    const input: MsmeOnboardingInput = {
      ...MSME_INPUT,
      fixedExpenses: [
        { name: 'Rent', amount: 15000, dueDay: 1, category: 'rent' },
        { name: 'Salaries', amount: 15000, dueDay: 28, category: 'salary' },
      ],
      customPockets: [{ name: 'Stock', category: 'stock' }],
    };

    await service.commitMsme(input, 'user-1');

    const pockets = repository.commitOnboardingAtomic.mock.calls[0][0].pockets;
    const fixed = pockets.filter((p: any) => p.kind === 'fixed');
    expect(fixed.map((p: any) => p.category).sort()).toEqual(['rent', 'salary']);
    expect(fixed.every((p: any) => p.is_time_locked === true)).toBe(true);
  });

  it('rejects more than 6 custom pockets even though the schema already caps it', async () => {
    const input: MsmeOnboardingInput = {
      ...MSME_INPUT,
      customPockets: Array.from({ length: 7 }, (_, i) => ({ name: `Pocket ${i}`, category: 'operations' })),
    };

    await expect(service.commitMsme(input, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.commitOnboardingAtomic).not.toHaveBeenCalled();
  });

  it('does not deactivate the individual plan when committing MSME (two concurrent active plans)', async () => {
    await service.commitMsme(MSME_INPUT, 'user-1');
    expect(repository.deactivateUserPlans).not.toHaveBeenCalled();
    expect(repository.commitOnboardingAtomic.mock.calls[0][0].segment).toBe('msme');
  });

  it('maps an RPC rejection to a clean conflict', async () => {
    repository.commitOnboardingAtomic.mockResolvedValue(null);

    await expect(service.commitMsme(MSME_INPUT, 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });
});