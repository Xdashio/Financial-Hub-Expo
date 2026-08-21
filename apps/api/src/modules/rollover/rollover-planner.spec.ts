import {
  catchupDateIsos,
  effectiveDailyCap,
  planDayRollover,
  previewDailyCapAfterSpend,
  remainingDaysAfterToday,
  utcDayBounds,
} from './rollover-planner';

describe('effectiveDailyCap', () => {
  it('prefers a positive daily_cap when present', () => {
    expect(effectiveDailyCap({ daily_cap: 400, monthly_allocation: 12000 }, '2026-08-10', 'daily')).toBe(400);
  });

  it('derives from monthly_allocation when daily_cap is null for daily plans', () => {
    // August has 31 days
    expect(effectiveDailyCap({ daily_cap: null, monthly_allocation: 3100 }, '2026-08-10', 'daily')).toBe(100);
  });

  it('returns 0 for structured plans regardless of daily_cap', () => {
    expect(effectiveDailyCap({ daily_cap: 400, monthly_allocation: 12000 }, '2026-08-10', 'structured')).toBe(0);
  });

  it('returns 0 for structured plans even with null daily_cap', () => {
    expect(effectiveDailyCap({ daily_cap: null, monthly_allocation: 3100 }, '2026-08-10', 'structured')).toBe(0);
  });
});

describe('planDayRollover', () => {
  it('rolls unspent under-cap amounts and conserves total across pockets', () => {
    const plan = planDayRollover('2026-08-09', [
      { pocketId: 'food', pocketName: 'Food', dailyCap: 500, spent: 200, available: 8000 },
      { pocketId: 'transport', pocketName: 'Transport', dailyCap: 300, spent: 300, available: 2000 },
    ]);

    expect(plan.allUnderCap).toBe(true);
    expect(plan.anyOverspend).toBe(false);
    expect(plan.totalRollAmount).toBe(300); // 300 + 0
    expect(plan.pockets[0].rollAmount).toBe(300);
    expect(plan.pockets[1].rollAmount).toBe(0);
  });

  it('never rolls more than available balance', () => {
    const plan = planDayRollover('2026-08-09', [
      { pocketId: 'food', pocketName: 'Food', dailyCap: 500, spent: 0, available: 100 },
    ]);

    expect(plan.totalRollAmount).toBe(100);
  });

  it('zeros all roll amounts on an overspend day', () => {
    const plan = planDayRollover('2026-08-09', [
      { pocketId: 'food', pocketName: 'Food', dailyCap: 500, spent: 600, available: 8000 },
      { pocketId: 'transport', pocketName: 'Transport', dailyCap: 300, spent: 100, available: 2000 },
    ]);

    expect(plan.anyOverspend).toBe(true);
    expect(plan.allUnderCap).toBe(false);
    expect(plan.totalRollAmount).toBe(0);
    expect(plan.pockets.every((p) => p.rollAmount === 0)).toBe(true);
  });

  it('treats exact-cap spend as under-cap with zero roll', () => {
    const plan = planDayRollover('2026-08-09', [
      { pocketId: 'food', pocketName: 'Food', dailyCap: 500, spent: 500, available: 8000 },
    ]);

    expect(plan.allUnderCap).toBe(true);
    expect(plan.totalRollAmount).toBe(0);
  });
});

describe('catchupDateIsos / utcDayBounds', () => {
  it('returns yesterday back through N days, oldest first', () => {
    const now = new Date('2026-08-10T15:00:00.000Z');
    expect(catchupDateIsos(now, 3)).toEqual(['2026-08-07', '2026-08-08', '2026-08-09']);
  });

  it('builds exclusive UTC day bounds', () => {
    expect(utcDayBounds('2026-08-09')).toEqual({
      startIso: '2026-08-09T00:00:00.000Z',
      endIsoExclusive: '2026-08-10T00:00:00.000Z',
    });
  });
});

describe('remainingDaysAfterToday / previewDailyCapAfterSpend', () => {
  it('counts calendar days left in the month after today, today excluded', () => {
    // 30-day month, day 15 -> 15 days left (16th through 30th)
    expect(remainingDaysAfterToday('2026-06-15')).toBe(15);
    // Last day of the month -> 0 days left
    expect(remainingDaysAfterToday('2026-06-30')).toBe(0);
  });

  it('matches the worked example: 25,000 left, 2,000 emergency spend on day 15 of 30', () => {
    // 30,000 income - 5,000 fixed+savings = 25,000 spendable, 833.33/day.
    // By day 15 nothing else has been spent, so available balance is still
    // the full 25,000. A 2,000 emergency spend today should re-flatten the
    // remaining 25,000 - 2,000 = 23,000 across the 15 days left.
    const preview = previewDailyCapAfterSpend({
      dailyCap: 833.33,
      spentToday: 0,
      requestedAmount: 2000,
      availableBalance: 25000,
      dateIso: '2026-06-15',
    });

    expect(preview.exceedsCap).toBe(true);
    expect(preview.daysRemaining).toBe(15);
    expect(preview.adjustedDailyCap).toBeCloseTo(23000 / 15, 2);
  });

  it('does not flag a spend that fits within what is left of today\'s cap', () => {
    const preview = previewDailyCapAfterSpend({
      dailyCap: 833,
      spentToday: 200,
      requestedAmount: 600,
      availableBalance: 25000,
      dateIso: '2026-06-15',
    });

    expect(preview.exceedsCap).toBe(false);
  });

  it('falls back to spreading the leftover balance on the last day of the month', () => {
    const preview = previewDailyCapAfterSpend({
      dailyCap: 833,
      spentToday: 0,
      requestedAmount: 1000,
      availableBalance: 900,
      dateIso: '2026-06-30',
    });

    expect(preview.daysRemaining).toBe(0);
    // availableBalance - requestedAmount goes negative, clamped to 0
    expect(preview.adjustedDailyCap).toBe(0);
  });
});