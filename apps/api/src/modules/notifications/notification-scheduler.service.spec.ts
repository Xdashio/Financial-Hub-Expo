import { NotificationSchedulerService } from './notification-scheduler.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { PushDeliveryService } from './push-delivery.service';
import type { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { EVENT_DAILY_OVERSPEND, EVENT_DAILY_ROLLOVER_SUCCESS } from '../rollover/rollover.constants';

describe('NotificationSchedulerService', () => {
  let repository: any;
  let push: any;
  let disciplineScore: any;
  let service: NotificationSchedulerService;

  beforeEach(() => {
    repository = {
      getCoolingOffReallocationsEndingBetween: jest.fn().mockResolvedValue([]),
      resolveUserIdForPocket: jest.fn().mockResolvedValue('user-1'),
      getBehaviorEventsByTypesSince: jest.fn().mockResolvedValue([]),
      // Money-personality modifier layer (§2.3) — sendStreakAtRiskNudges
      // reads the user's plan personality for its cadence gate. Default to
      // a plan with no personality set (falls back to 'saver' inside
      // notificationCadenceFor), same as a plan that predates the
      // migration; individual tests override this when the personality
      // itself matters.
      getActivePlanByUserId: jest.fn().mockResolvedValue({ money_personality: undefined }),
    };
    push = {
      notifyCoolingOffReady: jest.fn().mockResolvedValue({ sent: true }),
      notifyStreakAtRisk: jest.fn().mockResolvedValue({ sent: true }),
      notifyMonthlyInsight: jest.fn().mockResolvedValue({ sent: true }),
      listUserIdsWithPreferenceAndTokens: jest.fn().mockResolvedValue(['user-1']),
    };
    disciplineScore = {
      getCurrentScore: jest.fn().mockResolvedValue(88),
    };
    service = new NotificationSchedulerService(
      repository as unknown as SupabaseRepository,
      push as unknown as PushDeliveryService,
      disciplineScore as unknown as DisciplineScoreService,
    );
  });

  it('sends cooling-off reminders for reallocations whose window just ended', async () => {
    repository.getCoolingOffReallocationsEndingBetween.mockResolvedValue([
      { id: 'realloc-1', from_pocket_id: 'pocket-1', amount: 500 },
    ]);

    const result = await service.sendCoolingOffReminders(new Date('2026-08-10T12:00:00.000Z'));

    expect(result).toEqual({ checked: 1, sent: 1 });
    expect(push.notifyCoolingOffReady).toHaveBeenCalledWith('user-1', 'realloc-1', 500);
  });

  it('skips streak-at-risk when the user already overspent today', async () => {
    repository.getBehaviorEventsByTypesSince.mockResolvedValue([
      { type: EVENT_DAILY_OVERSPEND, payload: {}, created_at: '2026-08-10T10:00:00.000Z' },
    ]);

    const result = await service.sendStreakAtRiskNudges(new Date('2026-08-10T18:00:00.000Z'));

    expect(result.sent).toBe(0);
    expect(push.notifyStreakAtRisk).not.toHaveBeenCalled();
  });

  it('nudges streak-at-risk when there is an active under-cap streak', async () => {
    // Yesterday success → currentStreak includes yesterday; today incomplete does not break.
    repository.getBehaviorEventsByTypesSince.mockImplementation(
      async (_u: string, types: string[]) => {
        if (types.includes(EVENT_DAILY_ROLLOVER_SUCCESS)) {
          return [
            {
              type: EVENT_DAILY_ROLLOVER_SUCCESS,
              // amount must be present and nonzero — streak.ts's
              // collectSuccessDates now excludes zero/missing-amount
              // rollover events (anti-gaming), so this fixture needs one
              // to still count as a real streak day.
              payload: { date: '2026-08-09', amount: 150 },
              created_at: '2026-08-09T01:00:00.000Z',
            },
          ];
        }
        return [];
      },
    );

    const result = await service.sendStreakAtRiskNudges(new Date('2026-08-10T18:00:00.000Z'));

    expect(result.sent).toBe(1);
    expect(push.notifyStreakAtRisk).toHaveBeenCalledWith('user-1', expect.any(Number), '2026-08-10', 'neutral');
  });

  it('gates a saver to every other day, but always nudges an avoider (§2.3 cadence)', async () => {
    repository.getBehaviorEventsByTypesSince.mockImplementation(
      async (_u: string, types: string[]) => {
        if (types.includes(EVENT_DAILY_ROLLOVER_SUCCESS)) {
          return [
            { type: EVENT_DAILY_ROLLOVER_SUCCESS, payload: { date: '2026-08-10', amount: 150 }, created_at: '2026-08-10T01:00:00.000Z' },
          ];
        }
        return [];
      },
    );

    // 2026-08-11 is an odd day-of-year (223) — a saver's every-2-days gate
    // should skip it; an avoider's gate (round(0.5)=1) never skips.
    repository.getActivePlanByUserId.mockResolvedValue({ money_personality: 'saver' });
    const saverResult = await service.sendStreakAtRiskNudges(new Date('2026-08-11T18:00:00.000Z'));
    expect(saverResult.sent).toBe(0);
    expect(push.notifyStreakAtRisk).not.toHaveBeenCalled();

    repository.getActivePlanByUserId.mockResolvedValue({ money_personality: 'avoider' });
    const avoiderResult = await service.sendStreakAtRiskNudges(new Date('2026-08-11T18:00:00.000Z'));
    expect(avoiderResult.sent).toBe(1);
    expect(push.notifyStreakAtRisk).toHaveBeenCalledWith('user-1', expect.any(Number), '2026-08-11', 'gentle_frequent');
  });

  it('sends monthly insights with the current discipline score', async () => {
    const result = await service.sendMonthlyInsights(new Date('2026-09-01T09:00:00.000Z'));
    expect(result).toEqual({ candidates: 1, sent: 1 });
    expect(push.notifyMonthlyInsight).toHaveBeenCalledWith('user-1', '2026-08', 88);
  });
});