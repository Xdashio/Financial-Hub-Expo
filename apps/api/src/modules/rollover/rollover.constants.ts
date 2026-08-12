/**
 * Batch 6 scoring / rollover event constants.
 * Kept in one place so Insights heatmap, streak compute, and DisciplineScore
 * deltas cannot drift on event type strings or point values.
 */

export const EVENT_DAILY_ROLLOVER_SUCCESS = 'daily_rollover_success';
export const EVENT_DAILY_OVERSPEND = 'daily_overspend';
export const EVENT_STREAK_FREEZE_USED = 'streak_freeze_used';
export const EVENT_STREAK_MILESTONE = 'streak_milestone';
export const EVENT_FIXED_PAYMENT_ON_TIME = 'fixed_payment_on_time';
export const EVENT_GOAL_ACHIEVED = 'goal_achieved';
// Reconciled 2026-08-12: logged whenever a spend is blocked because the
// merchant is a known, already-classified gambling_betting recipient (not
// for an unclassified merchant the user hasn't sorted yet — that's a
// routing prompt, not a violation). The spend stays blocked either way —
// this never unblocks it. Gambling paybills/tills are registered and
// reliably identifiable, so this is a low-false-positive signal: a repeat
// attempt against a known-blocked recipient is a meaningful behavioral data
// point worth surfacing, even though the block itself never lifts.
export const EVENT_GAMBLING_BLOCKED_ATTEMPT = 'gambling_blocked_attempt';

/** Primary under-cap win — capped per calendar month. */
export const POINTS_DAILY_ROLLOVER_SUCCESS = 3;
export const CAP_DAILY_ROLLOVER_SUCCESS = 15;

export const POINTS_DAILY_OVERSPEND = -3;
export const CAP_DAILY_OVERSPEND = -15; // most negative allowed from this event type / month

// Steeper than daily overspend — attempting a gambling payment isn't a
// budgeting slip, it's the exact behavior the product exists to guard
// against. Still capped per month so one very bad week can't spiral a
// user's score to zero and make every other win meaningless; the cap is
// wider than overspend's because we want repeated attempts within a month
// to keep costing something, not flatten out after a handful of tries.
export const POINTS_GAMBLING_BLOCKED_ATTEMPT = -5;
export const CAP_GAMBLING_BLOCKED_ATTEMPT = -25; // most negative allowed from this event type / month

export const POINTS_STREAK_MILESTONE = 5;
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90] as const;

/** Incomplete "today" never breaks a streak; plus this many miss days may be absorbed. */
export const STREAK_GRACE_FREEZES_PER_MONTH = 1;

/** How many past UTC days (ending yesterday) a single /rollover/run may catch up. */
export const ROLLOVER_CATCHUP_DAYS = 7;