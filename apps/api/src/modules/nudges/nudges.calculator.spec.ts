import { computeRunwayNudges, MIN_DAYS_ELAPSED_FOR_VELOCITY } from './nudge.calculator';
import type { RunwayNudgeInput } from './nudge.calculator';

function pocket(overrides: Partial<RunwayNudgeInput['pockets'][number]> = {}) {
  return {
    pocketId: 'pocket-1',
    pocketName: 'Transport',
    availableBalance: 1000,
    spentInPeriod: 0,
    daysElapsedInPeriod: MIN_DAYS_ELAPSED_FOR_VELOCITY,
    ...overrides,
  };
}

describe('computeRunwayNudges', () => {
  it('flags a pocket on track to run dry before the horizon', () => {
    // Spending 200/day for 4 days = 800 spent, 1000 left, velocity 200/day
    // → projected 5 days to deplete, but there are 10 days until next
    // income — the pocket runs dry 5 days early.
    const nudges = computeRunwayNudges({
      horizonDays: 10,
      horizonSource: 'freelancer_runway',
      pockets: [
        pocket({ availableBalance: 1000, spentInPeriod: 800, daysElapsedInPeriod: 4 }),
      ],
    });

    expect(nudges).toHaveLength(1);
    expect(nudges[0]).toMatchObject({
      type: 'runway_low',
      pocketId: 'pocket-1',
      pocketName: 'Transport',
      dailyVelocity: 200,
      availableBalance: 1000,
      projectedDaysToDeplete: 5,
      horizonDays: 10,
    });
    // 5 days of runway left, but 10 days until next income — 5 days short.
    expect(nudges[0].daysShort).toBe(5);
  });

  it('does not flag a pocket that outlasts the horizon', () => {
    // 100 spent over 4 days = 25/day, 1000 left → 40 days of runway, well
    // past a 10-day horizon.
    const nudges = computeRunwayNudges({
      horizonDays: 10,
      horizonSource: 'calendar_month',
      pockets: [pocket({ availableBalance: 1000, spentInPeriod: 100, daysElapsedInPeriod: 4 })],
    });

    expect(nudges).toHaveLength(0);
  });

  it('ignores pockets with too little history to trust the velocity', () => {
    const nudges = computeRunwayNudges({
      horizonDays: 3,
      horizonSource: 'freelancer_runway',
      pockets: [
        // A single day of heavy spend shouldn't fire a nudge — needs at
        // least MIN_DAYS_ELAPSED_FOR_VELOCITY days of data.
        pocket({ availableBalance: 100, spentInPeriod: 900, daysElapsedInPeriod: 1 }),
      ],
    });

    expect(nudges).toHaveLength(0);
  });

  it('ignores a pocket that is already empty (that is insufficient_funds territory, not this nudge)', () => {
    const nudges = computeRunwayNudges({
      horizonDays: 3,
      horizonSource: 'calendar_month',
      pockets: [pocket({ availableBalance: 0, spentInPeriod: 500, daysElapsedInPeriod: 4 })],
    });

    expect(nudges).toHaveLength(0);
  });

  it('ignores a pocket with zero or negative spend velocity', () => {
    const nudges = computeRunwayNudges({
      horizonDays: 3,
      horizonSource: 'calendar_month',
      pockets: [pocket({ availableBalance: 1000, spentInPeriod: 0, daysElapsedInPeriod: 5 })],
    });

    expect(nudges).toHaveLength(0);
  });

  it('sorts multiple nudges most-urgent (soonest to deplete) first', () => {
    const soon = pocket({
      pocketId: 'soon',
      pocketName: 'Soon',
      availableBalance: 200,
      spentInPeriod: 800,
      daysElapsedInPeriod: 4, // velocity 200/day -> 1 day left
    });
    const later = pocket({
      pocketId: 'later',
      pocketName: 'Later',
      availableBalance: 800,
      spentInPeriod: 800,
      daysElapsedInPeriod: 4, // velocity 200/day -> 4 days left
    });

    const nudges = computeRunwayNudges({
      horizonDays: 10,
      horizonSource: 'calendar_month',
      pockets: [later, soon],
    });

    expect(nudges.map((n) => n.pocketId)).toEqual(['soon', 'later']);
  });

  it('always reports at least 1 day short when a nudge fires', () => {
    // Rounds to exactly on the boundary — daysShort should floor at 1, not 0,
    // since the nudge only fires when strictly under horizon.
    const nudges = computeRunwayNudges({
      horizonDays: 5,
      horizonSource: 'calendar_month',
      pockets: [pocket({ availableBalance: 999, spentInPeriod: 800, daysElapsedInPeriod: 4 })],
    });

    expect(nudges).toHaveLength(1);
    expect(nudges[0].daysShort).toBeGreaterThanOrEqual(1);
  });
});