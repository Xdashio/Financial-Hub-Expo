import {
  computeRunway,
  computeSpendableDailyCaps,
  MIN_RUNWAY_DAYS,
  MIN_EXPECTED_INTERVAL_DAYS,
  MAX_EXPECTED_INTERVAL_DAYS,
} from './runway.calculator';

describe('computeRunway', () => {
  const today = new Date('2026-09-16T12:00:00.000Z');

  it('uses the onboarding estimate when fewer than 2 income events exist', () => {
    const result = computeRunway({
      incomeIntervalDaysEstimate: 14,
      incomeEvents: [{ date: '2026-09-10' }],
      today,
      reserveBalance: 10000,
      fixedObligations: 4000,
      dailyBudget: 200,
    });

    expect(result.applicable).toBe(true);
    expect(result.confidence).toBe('estimate');
    expect(result.expectedIntervalDays).toBe(14);
    expect(result.discretionaryReserve).toBe(6000);
    // floor(6000/200)=30, clamped to expectedIntervalDays=14
    expect(result.runwayDays).toBe(14);
    // 2026-09-10T00:00Z → 2026-09-16T12:00Z rounds to 7 calendar days
    expect(result.daysSinceLastIncome).toBe(7);
  });

  it('averages recent gaps for historical confidence and clamps the interval', () => {
    const result = computeRunway({
      incomeIntervalDaysEstimate: 30,
      incomeEvents: [
        { date: '2026-09-15' },
        { date: '2026-09-01' }, // 14-day gap
        { date: '2026-08-18' }, // 14-day gap
        { date: '2026-08-01' }, // 17-day gap (inside 3-gap window)
      ],
      today,
      reserveBalance: 9000,
      fixedObligations: 3000,
      dailyBudget: 200,
    });

    expect(result.confidence).toBe('historical');
    // avg(14, 14, 17) = 15
    expect(result.expectedIntervalDays).toBe(15);
    expect(result.runwayDays).toBe(15); // floor(6000/200)=30 clamped to 15
  });

  it('never collapses runway below MIN_RUNWAY_DAYS', () => {
    const result = computeRunway({
      incomeIntervalDaysEstimate: 30,
      incomeEvents: [],
      today,
      reserveBalance: 100,
      fixedObligations: 90,
      dailyBudget: 50,
    });

    expect(result.runwayDays).toBe(MIN_RUNWAY_DAYS);
    expect(result.discretionaryReserve).toBe(10);
  });

  it('clamps expected interval to the documented min/max bounds', () => {
    const tight = computeRunway({
      incomeIntervalDaysEstimate: 1,
      incomeEvents: [],
      today,
      reserveBalance: 10000,
      fixedObligations: 0,
      dailyBudget: 100,
    });
    expect(tight.expectedIntervalDays).toBe(MIN_EXPECTED_INTERVAL_DAYS);

    const wide = computeRunway({
      incomeIntervalDaysEstimate: 120,
      incomeEvents: [],
      today,
      reserveBalance: 10000,
      fixedObligations: 0,
      dailyBudget: 100,
    });
    expect(wide.expectedIntervalDays).toBe(MAX_EXPECTED_INTERVAL_DAYS);
  });
});

describe('computeSpendableDailyCaps', () => {
  it('returns an empty map when runway is not applicable', () => {
    const caps = computeSpendableDailyCaps(
      [{ id: 'p1', kind: 'spendable', monthly_allocation: 3000 }],
      { applicable: false },
    );
    expect(caps.size).toBe(0);
  });

  it('proportions each spendable pocket by its own monthly_allocation across runway days', () => {
    const caps = computeSpendableDailyCaps(
      [
        { id: 'food', kind: 'spendable', monthly_allocation: 3000 },
        { id: 'personal', kind: 'spendable', monthly_allocation: 300 },
        { id: 'savings', kind: 'savings', monthly_allocation: 5000 },
      ],
      { applicable: true, runwayDays: 10 },
    );

    expect(caps.get('food')).toBe(300);
    expect(caps.get('personal')).toBe(30);
    expect(caps.has('savings')).toBe(false);
  });
});
