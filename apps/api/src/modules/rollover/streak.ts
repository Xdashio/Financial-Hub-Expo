import {
  EVENT_DAILY_ROLLOVER_SUCCESS,
  EVENT_STREAK_FREEZE_USED,
  STREAK_GRACE_FREEZES_PER_MONTH,
  STREAK_MILESTONES,
} from './rollover.constants';

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  /** Next milestone the user is approaching, or null if past the last. */
  nextMilestone: number | null;
  /** Milestone hit by the current streak exactly, if any. */
  hitMilestone: number | null;
  /** Freezes remaining this calendar month (UTC). */
  freezesRemaining: number;
  /** Whether today already has a success event. */
  todayCounted: boolean;
}

/**
 * Compute streak from success calendar days (YYYY-MM-DD), with:
 * - Incomplete today never breaks the streak (grace for the current day)
 * - Up to `freezesAvailable` missed past days can be absorbed
 *
 * `freezeUsedDates` are days already covered by a persisted freeze event
 * this month — they count as absorbed without consuming an extra freeze.
 */
export function computeStreak(options: {
  successDates: Iterable<string>;
  todayIso: string;
  freezesAvailable?: number;
  freezeUsedDates?: Iterable<string>;
  lookbackDays?: number;
}): StreakSummary {
  const success = new Set(options.successDates);
  const freezesUsed = new Set(options.freezeUsedDates ?? []);
  let freezesLeft = options.freezesAvailable ?? STREAK_GRACE_FREEZES_PER_MONTH;
  // Freezes already consumed this month reduce remaining inventory.
  freezesLeft = Math.max(0, freezesLeft - freezesUsed.size);

  const todayCounted = success.has(options.todayIso);
  const lookback = options.lookbackDays ?? 90;
  const todayMs = Date.parse(`${options.todayIso}T00:00:00.000Z`);
  const MS_DAY = 24 * 60 * 60 * 1000;

  // Walk backward starting at yesterday (today is grace if empty).
  let cursorMs = todayCounted ? todayMs : todayMs - MS_DAY;
  let current = 0;
  let freezesForCurrent = freezesLeft;

  for (let i = 0; i < lookback; i++) {
    const iso = new Date(cursorMs).toISOString().slice(0, 10);
    if (success.has(iso) || freezesUsed.has(iso)) {
      current += 1;
      cursorMs -= MS_DAY;
      continue;
    }
    if (freezesForCurrent > 0 && iso !== options.todayIso) {
      // Only spend a freeze when it bridges to another success/freeze day —
      // otherwise a trailing miss would inflate the streak with no history.
      let bridges = false;
      for (let j = 1; j <= lookback - i; j++) {
        const peek = new Date(cursorMs - j * MS_DAY).toISOString().slice(0, 10);
        if (success.has(peek) || freezesUsed.has(peek)) {
          bridges = true;
          break;
        }
      }
      if (bridges) {
        freezesForCurrent -= 1;
        current += 1;
        cursorMs -= MS_DAY;
        continue;
      }
    }
    break;
  }

  // Longest streak in the lookback window (freezes only apply to current).
  let longest = 0;
  let run = 0;
  for (let i = lookback - 1; i >= 0; i--) {
    const iso = new Date(todayMs - i * MS_DAY).toISOString().slice(0, 10);
    if (success.has(iso)) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (iso === options.todayIso && !todayCounted) {
      // ignore incomplete today
    } else {
      run = 0;
    }
  }
  longest = Math.max(longest, current);

  const hitMilestone =
    STREAK_MILESTONES.find((m) => m === current) ?? null;
  const nextMilestone =
    STREAK_MILESTONES.find((m) => m > current) ?? null;

  return {
    currentStreak: current,
    longestStreak: longest,
    nextMilestone,
    hitMilestone,
    freezesRemaining: freezesForCurrent,
    todayCounted,
  };
}

export function collectSuccessDates(
  events: Array<{ type: string; payload: Record<string, unknown> | null; created_at: string }>,
): Set<string> {
  const dates = new Set<string>();
  for (const event of events) {
    if (event.type !== EVENT_DAILY_ROLLOVER_SUCCESS) continue;
    const payloadDate = typeof event.payload?.date === 'string' ? event.payload.date : null;
    dates.add(payloadDate && /^\d{4}-\d{2}-\d{2}$/.test(payloadDate) ? payloadDate : event.created_at.slice(0, 10));
  }
  return dates;
}

export function collectFreezeUsedDates(
  events: Array<{ type: string; payload: Record<string, unknown> | null; created_at: string }>,
): Set<string> {
  const dates = new Set<string>();
  for (const event of events) {
    if (event.type !== EVENT_STREAK_FREEZE_USED) continue;
    const payloadDate = typeof event.payload?.date === 'string' ? event.payload.date : null;
    dates.add(payloadDate && /^\d{4}-\d{2}-\d{2}$/.test(payloadDate) ? payloadDate : event.created_at.slice(0, 10));
  }
  return dates;
}
