import { computeStreak, collectSuccessDates } from './streak';
import { EVENT_DAILY_ROLLOVER_SUCCESS } from './rollover.constants';

describe('computeStreak', () => {
  it('counts consecutive success days ending yesterday when today is empty (grace)', () => {
    const result = computeStreak({
      successDates: ['2026-08-07', '2026-08-08', '2026-08-09'],
      todayIso: '2026-08-10',
      freezesAvailable: 1,
    });

    expect(result.currentStreak).toBe(3);
    expect(result.todayCounted).toBe(false);
    expect(result.hitMilestone).toBe(3);
    expect(result.nextMilestone).toBe(7);
  });

  it('includes today when it already has a success', () => {
    const result = computeStreak({
      successDates: ['2026-08-08', '2026-08-09', '2026-08-10'],
      todayIso: '2026-08-10',
      freezesAvailable: 1,
    });

    expect(result.currentStreak).toBe(3);
    expect(result.todayCounted).toBe(true);
  });

  it('absorbs one missed day with a freeze', () => {
    const result = computeStreak({
      successDates: ['2026-08-07', '2026-08-09'],
      todayIso: '2026-08-10',
      freezesAvailable: 1,
    });

    // 09 success, 08 absorbed by freeze, 07 success → streak 3
    expect(result.currentStreak).toBe(3);
    expect(result.freezesRemaining).toBe(0);
  });

  it('breaks when a miss exceeds freeze inventory', () => {
    const result = computeStreak({
      successDates: ['2026-08-05', '2026-08-09'],
      todayIso: '2026-08-10',
      freezesAvailable: 1,
    });

    // 09 success; 08 freeze; 07 miss with no freezes left → stop at 2
    expect(result.currentStreak).toBe(2);
  });

  it('treats persisted freeze-used dates as already absorbed', () => {
    const result = computeStreak({
      successDates: ['2026-08-07', '2026-08-09'],
      todayIso: '2026-08-10',
      freezesAvailable: 1,
      freezeUsedDates: ['2026-08-08'],
    });

    expect(result.currentStreak).toBe(3);
    expect(result.freezesRemaining).toBe(0);
  });
});

describe('collectSuccessDates', () => {
  it('prefers payload.date over created_at', () => {
    const dates = collectSuccessDates([
      {
        type: EVENT_DAILY_ROLLOVER_SUCCESS,
        payload: { date: '2026-08-09' },
        created_at: '2026-08-10T08:00:00.000Z',
      },
    ]);
    expect([...dates]).toEqual(['2026-08-09']);
  });
});
