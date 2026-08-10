import {
  catchupDateIsos,
  effectiveDailyCap,
  planDayRollover,
  utcDayBounds,
} from './rollover-planner';

describe('effectiveDailyCap', () => {
  it('prefers a positive daily_cap when present', () => {
    expect(effectiveDailyCap({ daily_cap: 400, monthly_allocation: 12000 }, '2026-08-10')).toBe(400);
  });

  it('derives from monthly_allocation when daily_cap is null', () => {
    // August has 31 days
    expect(effectiveDailyCap({ daily_cap: null, monthly_allocation: 3100 }, '2026-08-10')).toBe(100);
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
