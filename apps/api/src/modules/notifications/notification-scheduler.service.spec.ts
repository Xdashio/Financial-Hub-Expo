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
    expect(push.notifyStreakAtRisk).toHaveBeenCalledWith('user-1', expect.any(Number), '2026-08-10');
  });

  it('sends monthly insights with the current discipline score', async () => {
    const result = await service.sendMonthlyInsights(new Date('2026-09-01T09:00:00.000Z'));
    expect(result).toEqual({ candidates: 1, sent: 1 });
    expect(push.notifyMonthlyInsight).toHaveBeenCalledWith('user-1', '2026-08', 88);
  });
});