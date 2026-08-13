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
      created_at: '2026-08-10T15:00:00.000Z',
    });

    const result = await service.runForUser('user-1', new Date('2026-08-10T18:00:00.000Z'));

    expect(repository.createTransactions).not.toHaveBeenCalled();
    expect(repository.createBehaviorEvent).not.toHaveBeenCalled();
    expect(disciplineScore.applyDelta).not.toHaveBeenCalled();
    expect(result.days).toEqual([]);
    expect(result.milestoneAwarded).toBeNull();
  });
});
