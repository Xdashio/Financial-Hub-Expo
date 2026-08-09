import { BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { OnboardingInput } from '@financial-hub/shared';

function makeRepository(overrides: Partial<jest.Mocked<SupabaseRepository>> = {}) {
  return {
    deactivateUserPlans: jest.fn().mockResolvedValue(undefined),
    createPlan: jest.fn().mockImplementation((plan) => ({ ...plan })),
    createPockets: jest.fn().mockImplementation((pockets) => pockets),
    createFixedExpense: jest.fn().mockResolvedValue({ id: 'fe-1' }),
    createTransactions: jest.fn().mockResolvedValue([]),
    createBehaviorEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
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

  it('falls back to a daily-budget plan when a tracker has less than 20% of income remaining', () => {
    const result = service.assign({
      incomePattern: 'salaried',
      spendingHabit: 'tracker',
      incomeAmount: 50000,
      fixedTotal: 45000, // remaining 5000, well under 20% of 50000
      sourceCount: 1,
    });

    expect(result.planType).toBe('daily');
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

    // Structured plans divide the spendable amount evenly across the three
    // categories.
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

  it('creates an allocation transaction per created pocket', async () => {
    await service.commit(SALARIED_TRACKER_INPUT, 'user-1');

    const pockets = repository.createPockets.mock.results[0].value;
    const transactions = repository.createTransactions.mock.calls[0][0];

    expect(transactions).toHaveLength(pockets.length);
    expect(transactions.every((t: any) => t.type === 'allocation')).toBe(true);
    for (const pocket of pockets) {
      expect(transactions).toContainEqual(
        expect.objectContaining({ pocket_id: pocket.id, amount: pocket.monthly_allocation })
      );
    }
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
