import { RolloverService } from './rollover.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { EVENT_DAILY_ROLLOVER_SUCCESS, EVENT_DAILY_OVERSPEND } from './rollover.constants';

const FOOD = {
  id: 'pocket-food',
  plan_id: 'plan-1',
  name: 'Food',
  kind: 'spendable' as const,
  category: 'food',
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 10000,
  daily_cap: 500,
  created_at: 'x',
  updated_at: 'x',
};

const SAVINGS = {
  ...FOOD,
  id: 'pocket-savings',
  name: 'Savings',
  kind: 'savings' as const,
  category: null,
  daily_cap: null,
};

describe('RolloverService.runForUser', () => {
  let repository: any;
  let disciplineScore: jest.Mocked<Pick<DisciplineScoreService, 'applyDelta'>>;
  let service: RolloverService;

  beforeEach(() => {
    repository = {
      getActivePlanByUserId: jest.fn().mockResolvedValue({
        id: 'plan-1',
        user_id: 'user-1',
        type: 'daily',
        created_at: '2026-07-01T00:00:00.000Z',
      }),
      getPocketsByPlanId: jest.fn().mockResolvedValue([FOOD, SAVINGS]),
      getBehaviorEventsByTypesSince: jest.fn().mockResolvedValue([]),
      getSpendTotalsByPocketBetween: jest.fn().mockResolvedValue(new Map([[FOOD.id, 200]])),
      getPocketSummary: jest.fn().mockResolvedValue({
        allocated: 10000,
        spent: 200,
        available: 9800,
        transactionCount: 1,
        reallocationCount: 0,
      }),
      createTransactions: jest.fn().mockResolvedValue([]),
      createBehaviorEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      getRolloverCreditsForPocketBetween: jest.fn().mockResolvedValue(0),
      hasRolloverLedgerRowsForDate: jest.fn().mockResolvedValue(false),
      acquireRolloverLock: jest.fn().mockResolvedValue(true),
      releaseRolloverLock: jest.fn().mockResolvedValue(undefined),
    };
    disciplineScore = {
      applyDelta: jest.fn().mockResolvedValue({ previousScore: 100, newScore: 103 }),
    };
    service = new RolloverService(
      repository as unknown as SupabaseRepository,
      disciplineScore as unknown as DisciplineScoreService,
      {
        notifyStreakMilestone: jest.fn().mockResolvedValue({ sent: false }),
        notifyRolloverSuccess: jest.fn().mockResolvedValue({ sent: false }),
      } as any,
    );
  });

  it('writes signed rollover ledger rows that conserve money into Savings', async () => {
    const now = new Date('2026-08-10T12:00:00.000Z');
    // Only process yesterday by pre-marking older catch-up days as done.
    repository.getBehaviorEventsByTypesSince.mockImplementation(async (_u: string, types: string[]) => {
      if (types.includes(EVENT_DAILY_ROLLOVER_SUCCESS)) {
        return [
          { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-03' }, created_at: '2026-08-03T01:00:00.000Z' },
          { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-04' }, created_at: '2026-08-04T01:00:00.000Z' },
          { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-05' }, created_at: '2026-08-05T01:00:00.000Z' },
          { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-06' }, created_at: '2026-08-06T01:00:00.000Z' },
          { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-07' }, created_at: '2026-08-07T01:00:00.000Z' },
          { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-08' }, created_at: '2026-08-08T01:00:00.000Z' },
        ];
      }
      return [];
    });

    const result = await service.runForUser('user-1', now);

    expect(repository.createTransactions).toHaveBeenCalled();
    const rows = repository.createTransactions.mock.calls[0][0];
    const out = rows.filter((r: any) => r.amount < 0).reduce((s: number, r: any) => s + r.amount, 0);
    const inn = rows.filter((r: any) => r.amount > 0).reduce((s: number, r: any) => s + r.amount, 0);
    expect(out + inn).toBe(0);
    expect(inn).toBe(300); // cap 500 - spent 200
    expect(result.latestAmount).toBe(300);
    expect(repository.createBehaviorEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EVENT_DAILY_ROLLOVER_SUCCESS,
        payload: expect.objectContaining({ date: '2026-08-09', amount: 300 }),
      }),
    );
    expect(disciplineScore.applyDelta).toHaveBeenCalledWith('user-1', 3);
  });

  it('BUG REGRESSION (2026-08-27): stamps each catch-up day\'s rollover rows with that day\'s own date, not the moment the sweep ran', async () => {
    // Nothing pre-processed -> two full catch-up days get swept in one
    // pass (2026-08-08 and 2026-08-09), simulating a user who hasn't
    // opened the app in a couple of days. Before the fix, createTransactions
    // never set created_at, so every row from every day defaulted to
    // whatever the DB clock was at insert time — collapsing two distinct
    // days' rollovers into what looked like duplicate transactions fired
    // at the same instant in transaction history.
    const now = new Date('2026-08-10T12:00:00.000Z');
    repository.getBehaviorEventsByTypesSince.mockImplementation(async (_u: string, types: string[]) => {
      if (types.includes(EVENT_DAILY_ROLLOVER_SUCCESS)) {
        return [
          { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-03' }, created_at: '2026-08-03T01:00:00.000Z' },
          { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-04' }, created_at: '2026-08-04T01:00:00.000Z' },
          { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-05' }, created_at: '2026-08-05T01:00:00.000Z' },
          { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-06' }, created_at: '2026-08-06T01:00:00.000Z' },
          { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-07' }, created_at: '2026-08-07T01:00:00.000Z' },
        ];
      }
      return [];
    });

    await service.runForUser('user-1', now);

    // Two separate createTransactions calls, one per catch-up day.
    expect(repository.createTransactions).toHaveBeenCalledTimes(2);
    const [firstDayRows] = repository.createTransactions.mock.calls[0];
    const [secondDayRows] = repository.createTransactions.mock.calls[1];

    // Every row must carry an explicit created_at matching the calendar
    // day it represents — not be left unset (which would default to "now"
    // and make every catch-up day indistinguishable in transaction history).
    for (const row of firstDayRows) {
      expect(row.created_at).toBe('2026-08-08T00:00:00.000Z');
    }
    for (const row of secondDayRows) {
      expect(row.created_at).toBe('2026-08-09T00:00:00.000Z');
    }
    // And the two days must not share a timestamp.
    expect(firstDayRows[0].created_at).not.toBe(secondDayRows[0].created_at);
  });

  it('is idempotent when yesterday was already processed', async () => {
    repository.getBehaviorEventsByTypesSince.mockResolvedValue([
      {
        type: EVENT_DAILY_ROLLOVER_SUCCESS,
        payload: { date: '2026-08-09' },
        created_at: '2026-08-10T01:00:00.000Z',
      },
      // Mark the rest of the catch-up window too
      ...['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08'].map((date) => ({
        type: EVENT_DAILY_ROLLOVER_SUCCESS,
        payload: { date },
        created_at: `${date}T01:00:00.000Z`,
      })),
    ]);

    const result = await service.runForUser('user-1', new Date('2026-08-10T12:00:00.000Z'));

    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(result.days.every((d) => d.skipped)).toBe(true);
  });

  it('records overspend without moving money', async () => {
    repository.getSpendTotalsByPocketBetween.mockResolvedValue(new Map([[FOOD.id, 800]]));
    repository.getBehaviorEventsByTypesSince.mockImplementation(async (_u: string, types: string[]) => {
      if (types.includes(EVENT_DAILY_ROLLOVER_SUCCESS) || types.includes(EVENT_DAILY_OVERSPEND)) {
        return [
          ...['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08'].map((date) => ({
            type: EVENT_DAILY_ROLLOVER_SUCCESS,
            payload: { date },
            created_at: `${date}T01:00:00.000Z`,
          })),
        ];
      }
      return [];
    });

    const result = await service.runForUser('user-1', new Date('2026-08-10T12:00:00.000Z'));

    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(repository.createBehaviorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: EVENT_DAILY_OVERSPEND }),
    );
    expect(result.latestAmount).toBe(0);
    expect(disciplineScore.applyDelta).toHaveBeenCalledWith('user-1', -3);
  });

  it('does not invent catch-up wins for days before the plan existed', async () => {
    // Plan created today — catch-up window is yesterday..-7d, all before
    // planCreatedDate, so no days should be processed.
    repository.getActivePlanByUserId.mockResolvedValue({
      id: 'plan-1',
      user_id: 'user-1',
      type: 'daily',
      created_at: '2026-08-10T15:00:00.000Z',
    });

    const result = await service.runForUser('user-1', new Date('2026-08-10T18:00:00.000Z'));

    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(repository.createBehaviorEvent).not.toHaveBeenCalled();
    expect(disciplineScore.applyDelta).not.toHaveBeenCalled();
    expect(result.days).toEqual([]);
    expect(result.milestoneAwarded).toBeNull();
  });

  it('does not re-insert rollover ledger rows when they already exist for the day', async () => {
    // Simulate the crash-between-writes case: a prior run committed the
    // ledger rows but never emitted EVENT_DAILY_ROLLOVER_SUCCESS. The behavior
    // event dedup alone would see this day as unhandled and re-insert the
    // rows (duplicate "+KSh X rollover" entries). The new ledger guard must
    // treat an already-swept day as done.
    repository.hasRolloverLedgerRowsForDate.mockResolvedValue(true);

    const result = await service.runForUser('user-1', new Date('2026-08-10T18:00:00.000Z'));

    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(result.latestAmount).toBe(0);
    expect(
      result.days.every((d) => d.skipped || d.amount === 0),
    ).toBe(true);
  });

  it('still inserts rollover rows on a fresh day (guard does not over-skip)', async () => {
    repository.hasRolloverLedgerRowsForDate.mockResolvedValue(false);

    const result = await service.runForUser('user-1', new Date('2026-08-10T18:00:00.000Z'));

    expect(repository.createTransactions).toHaveBeenCalled();
    expect(result.latestAmount).toBeGreaterThan(0);
  });

  it('skips rollover gracefully when no savings pocket exists instead of crashing', async () => {
    repository.getPocketsByPlanId.mockResolvedValue([FOOD]); // Food only, no savings
    repository.hasRolloverLedgerRowsForDate.mockResolvedValue(false);

    const result = await service.runForUser('user-1', new Date('2026-08-10T18:00:00.000Z'));

    expect(result).toBeDefined();
    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(result.days.some(d => d.skipped && d.skipReason === 'no_savings_pocket')).toBe(true);
  });

  it('records zero-amount success event so zero-roll days are not repeatedly re-evaluated', async () => {
    // Spent matches daily cap exactly (500 - 500 = 0 to roll)
    repository.getSpendTotalsByPocketBetween.mockResolvedValue(new Map([[FOOD.id, 500]]));
    repository.hasRolloverLedgerRowsForDate.mockResolvedValue(false);

    const result = await service.runForUser('user-1', new Date('2026-08-10T18:00:00.000Z'));

    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(repository.createBehaviorEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EVENT_DAILY_ROLLOVER_SUCCESS,
        payload: expect.objectContaining({ amount: 0 }),
      }),
    );
  });

  it('serializes concurrent sweeps (033) — lock loser returns empty result and never writes', async () => {
    repository.acquireRolloverLock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    repository.hasRolloverLedgerRowsForDate.mockResolvedValue(false);

    const [winner, loser] = await Promise.all([
      service.runForUser('user-1', new Date('2026-08-10T18:00:00.000Z')),
      service.runForUser('user-1', new Date('2026-08-10T18:00:00.000Z')),
    ]);

    expect(winner.latestAmount).toBeGreaterThan(0);
    expect(loser.days).toEqual([]);
    expect(loser.totalAmount).toBe(0);
    expect(repository.acquireRolloverLock).toHaveBeenCalledTimes(2);
    // Catch-up days each write their own batch; the lock loser writes none.
    expect(repository.createTransactions).toHaveBeenCalled();
    expect(repository.releaseRolloverLock).toHaveBeenCalled();
  });
});
