import {
  computeRunwayNudges,
  MIN_DAYS_ELAPSED_FOR_VELOCITY,
  computeSurplusSweepNudges,
  SURPLUS_ALLOCATION_MULTIPLIER,
  computeStreakAtRiskNudge,
  STREAK_AT_RISK_HOUR_UTC,
} from './nudge.calculator';
import type { RunwayNudgeInput, PocketAllocationSnapshot } from './nudge.calculator';

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

function allocationSnapshot(overrides: Partial<PocketAllocationSnapshot> = {}): PocketAllocationSnapshot {
  return {
    pocketId: 'pocket-1',
    pocketName: 'Transport',
    availableBalance: 6000,
    monthlyAllocation: 6000,
    ...overrides,
  };
}

const SAVINGS_TARGET = { pocketId: 'pocket-savings', pocketName: 'Savings' };

describe('computeSurplusSweepNudges', () => {
  it('returns [] when there is no Savings target to sweep into', () => {
    const nudges = computeSurplusSweepNudges(
      [allocationSnapshot({ availableBalance: 10000, monthlyAllocation: 6000 })],
      null,
    );
    expect(nudges).toEqual([]);
  });

  it('flags a pocket sitting above the surplus threshold and suggests bringing it back to its allocation', () => {
    // 6000 allocation * 1.2 = 7200 threshold. 10000 available is well past it.
    const nudges = computeSurplusSweepNudges(
      [allocationSnapshot({ availableBalance: 10000, monthlyAllocation: 6000 })],
      SAVINGS_TARGET,
    );

    expect(nudges).toHaveLength(1);
    expect(nudges[0]).toMatchObject({
      type: 'sweep_surplus',
      pocketId: 'pocket-1',
      amount: 4000, // brings balance back down to the 6000 allocation
      availableBalance: 10000,
      monthlyAllocation: 6000,
      targetPocketId: SAVINGS_TARGET.pocketId,
      targetPocketName: SAVINGS_TARGET.pocketName,
    });
  });

  it('does not fire at exactly the threshold multiplier, only strictly above it', () => {
    const nudges = computeSurplusSweepNudges(
      [allocationSnapshot({ availableBalance: 6000 * SURPLUS_ALLOCATION_MULTIPLIER, monthlyAllocation: 6000 })],
      SAVINGS_TARGET,
    );
    expect(nudges).toEqual([]);
  });

  it('does not fire for a pocket comfortably within its allocation', () => {
    const nudges = computeSurplusSweepNudges(
      [allocationSnapshot({ availableBalance: 5000, monthlyAllocation: 6000 })],
      SAVINGS_TARGET,
    );
    expect(nudges).toEqual([]);
  });

  it('skips pockets with no allocation on file rather than dividing by zero', () => {
    const nudges = computeSurplusSweepNudges(
      [allocationSnapshot({ availableBalance: 5000, monthlyAllocation: 0 })],
      SAVINGS_TARGET,
    );
    expect(nudges).toEqual([]);
  });

  it('sorts multiple surplus pockets biggest-surplus-first', () => {
    const small = allocationSnapshot({ pocketId: 'small', availableBalance: 7500, monthlyAllocation: 6000 }); // +1500
    const big = allocationSnapshot({ pocketId: 'big', availableBalance: 20000, monthlyAllocation: 6000 }); // +14000

    const nudges = computeSurplusSweepNudges([small, big], SAVINGS_TARGET);

    expect(nudges.map((n) => n.pocketId)).toEqual(['big', 'small']);
  });
});

describe('computeStreakAtRiskNudge', () => {
  const eveningUtc = new Date(Date.UTC(2026, 7, 13, STREAK_AT_RISK_HOUR_UTC, 0, 0));
  const morningUtc = new Date(Date.UTC(2026, 7, 13, STREAK_AT_RISK_HOUR_UTC - 2, 0, 0));

  it('returns null when there is no active streak to protect', () => {
    expect(computeStreakAtRiskNudge({ currentStreak: 0, spentToday: false, now: eveningUtc })).toBeNull();
  });

  it('returns null when a spend has already landed today', () => {
    expect(computeStreakAtRiskNudge({ currentStreak: 5, spentToday: true, now: eveningUtc })).toBeNull();
  });

  it('returns null before the evening cutoff, even with an active streak and no spend', () => {
    expect(computeStreakAtRiskNudge({ currentStreak: 5, spentToday: false, now: morningUtc })).toBeNull();
  });

  it('fires at/after the cutoff with an active streak and no spend logged today', () => {
    const nudge = computeStreakAtRiskNudge({ currentStreak: 5, spentToday: false, now: eveningUtc });
    expect(nudge).toEqual({ type: 'streak_at_risk', currentStreak: 5 });
  });
});