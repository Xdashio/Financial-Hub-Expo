import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { OnboardingInput } from '@financial-hub/shared';

function makeRepository(overrides: Partial<jest.Mocked<SupabaseRepository>> = {}) {
  return {
    deactivateUserPlans: jest.fn().mockResolvedValue(undefined),
    deactivateUserPlansExcept: jest.fn().mockResolvedValue(undefined),
    createPlan: jest.fn().mockImplementation((plan) => ({ ...plan })),
    updatePlan: jest.fn().mockImplementation((id, updates) => ({ id, ...updates })),
    createPockets: jest.fn().mockImplementation((pockets) => pockets),
    createFixedExpense: jest.fn().mockResolvedValue({ id: 'fe-1' }),
    deleteFixedExpensesByUserId: jest.fn().mockResolvedValue(undefined),
    createTransactions: jest.fn().mockResolvedValue([]),
    createBehaviorEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
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
    expect(result.savingsTarget).toBeCloseTo(3500); // 10% of remaining
    expect(result.spendableAmount).toBeCloseTo(31500);
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

describe('OnboardingService.commit', () => {
  let repository: ReturnType<typeof makeRepository>;
  let service: OnboardingService;

  beforeEach(() => {
    repository = makeRepository();
    service = new OnboardingService(repository);
  });

  it('rejects invalid input without touching the repository', async () => {
    await expect(service.commit({ incomeAmount: -1 }, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.deactivateUserPlans).not.toHaveBeenCalled();
    expect(repository.createPlan).not.toHaveBeenCalled();
  });

  it('deactivates existing plans before creating the new one', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    expect(repository.deactivateUserPlans).toHaveBeenCalledWith('user-1');
    expect(repository.deactivateUserPlans.mock.invocationCallOrder[0]).toBeLessThan(
      repository.createPlan.mock.invocationCallOrder[0]
    );
  });

  it('maps a "mix" income pattern to "salaried" when persisting the plan', async () => {
    await service.commit({ ...SALARIED_TRACKER_INPUT, incomePattern: 'mix' }, 'user-1');

    expect(repository.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', income_pattern: 'salaried', status: 'active' })
    );
  });

  it('creates a Fixed Expenses pocket, a locked Savings pocket, and evenly-split spendable pockets for a structured plan', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    const pockets = repository.createPockets.mock.calls[0][0];
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

    const pockets = repository.createPockets.mock.calls[0][0];
    const spendablePockets = pockets.filter((p: any) => p.kind === 'spendable');
    expect(spendablePockets.every((p: any) => typeof p.daily_cap === 'number' && p.daily_cap > 0)).toBe(true);
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

    const pockets = repository.createPockets.mock.calls[0][0];
    const fixed = pockets.filter((p: any) => p.kind === 'fixed');
    expect(fixed).toHaveLength(2);
    expect(fixed.every((p: any) => p.is_time_locked && p.lock_until)).toBe(true);
    expect(fixed.map((p: any) => p.name).sort()).toEqual(['Internet', 'Rent']);
  });

  it('adds a Family spendable pocket when hasDependents is set', async () => {
    await service.commit({ ...SALARIED_TRACKER_INPUT, hasDependents: true }, 'user-1');

    const pockets = repository.createPockets.mock.calls[0][0];
    const categories = pockets
      .filter((p: any) => p.kind === 'spendable')
      .map((p: any) => p.category)
      .sort();
    expect(categories).toEqual(['family', 'food', 'leisure', 'transport']);
  });

  it('creates one fixed expense row per submitted fixed expense', async () => {
    const input: OnboardingInput = {
      ...SALARIED_TRACKER_INPUT,
      fixedExpenses: [
        { name: 'Rent', amount: 10000, dueDay: 1, category: 'utilities' },
        { name: 'Internet', amount: 2000, dueDay: 5, category: 'transport' },
      ],
    };

    await service.commit(input, 'user-1');

    expect(repository.createFixedExpense).toHaveBeenCalledTimes(2);
    expect(repository.createFixedExpense).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', name: 'Rent', amount: 10000, due_day: 1, category: 'utilities' })
    );
    expect(repository.createFixedExpense).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', name: 'Internet', amount: 2000, due_day: 5, category: 'transport' })
    );
  });

  it('creates no fixed expense rows when none were submitted', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    expect(repository.createFixedExpense).not.toHaveBeenCalled();
  });

  // Regression test for the duplication bug: retake-checkin.tsx prefills
  // the form with the user's *existing* fixed expenses, then resubmits
  // that full list on save. Without clearing first, every retake
  // re-inserted the same rows on top of what was already there (visibly,
  // "Electricity" appearing 5x after a few retakes). commit() must give
  // full-replace semantics whenever fixedExpenses is provided at all.
  it('clears existing fixed expenses before inserting the submitted set (full replace, not append)', async () => {
    const input: OnboardingInput = {
      ...SALARIED_TRACKER_INPUT,
      fixedExpenses: [{ name: 'Rent', amount: 10000, dueDay: 1, category: 'utilities' }],
    };

    await service.commit(input, 'user-1');

    expect(repository.deleteFixedExpensesByUserId).toHaveBeenCalledWith('user-1');
    // Delete must happen before the new rows are inserted, not after.
    const deleteOrder = (repository.deleteFixedExpensesByUserId as jest.Mock).mock.invocationCallOrder[0];
    const createOrder = (repository.createFixedExpense as jest.Mock).mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  it('clears existing fixed expenses when an explicit empty array is submitted', async () => {
    const input: OnboardingInput = { ...SALARIED_TRACKER_INPUT, fixedExpenses: [] };

    await service.commit(input, 'user-1');

    expect(repository.deleteFixedExpensesByUserId).toHaveBeenCalledWith('user-1');
    expect(repository.createFixedExpense).not.toHaveBeenCalled();
  });

  it('leaves existing fixed expenses untouched when the field is omitted entirely', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

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

  it('logs a plan_created behavior event', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    expect(repository.createBehaviorEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        type: 'plan_created',
        payload: expect.objectContaining({ planType: 'structured', incomePattern: 'salaried' }),
      })
    );
  });

  it('throws when plan creation fails, without creating pockets', async () => {
    repository.createPlan.mockResolvedValue(null);

    await expect(service.commit(SALARIED_TRACKER_INPUT, 'user-1')).rejects.toThrow('Failed to create plan');
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
    expect(repository.createPlan).not.toHaveBeenCalled();
  });

  it('rejects when there is no active plan', async () => {
    repository.getActivePlanByUserId.mockResolvedValue(null);

    await expect(service.retake(SALARIED_TRACKER_INPUT, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('migrates balances onto the new pockets and conserves total money', async () => {
    const result = await service.retake(SALARIED_TRACKER_INPUT, 'user-1');

    expect(result.redistribution.totalMoved).toBeCloseTo(1600);
    expect(result.redistribution.previousPlanType).toBe('structured');
    expect(result.redistribution.newPlanType).toBe('structured');
    expect(result.redistribution.movements.length).toBeGreaterThan(0);

    const ledger = repository.createTransactions.mock.calls[0][0];
    const credited = ledger
      .filter((t: any) => t.type === 'reallocation_in')
      .reduce((s: number, t: any) => s + t.amount, 0);
    const debited = ledger
      .filter((t: any) => t.type === 'reallocation_out')
      .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
    expect(credited).toBeCloseTo(1600);
    expect(debited).toBeCloseTo(1600);

    expect(repository.deactivateUserPlans).toHaveBeenCalledWith('user-1');
    expect(repository.createBehaviorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', type: 'plan_retaken' }),
    );
  });

  it('re-activates the previous plan if creating the new one fails', async () => {
    repository.createPlan.mockResolvedValue(null);

    await expect(service.retake(SALARIED_TRACKER_INPUT, 'user-1')).rejects.toThrow('Failed to create plan');
    expect(repository.updatePlan).toHaveBeenCalledWith('plan-old', { status: 'active' });
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
    expect(repository.createTransactions).not.toHaveBeenCalled();
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