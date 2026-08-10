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

/** Primary under-cap win — capped per calendar month. */
export const POINTS_DAILY_ROLLOVER_SUCCESS = 3;
export const CAP_DAILY_ROLLOVER_SUCCESS = 15;

export const POINTS_DAILY_OVERSPEND = -3;
export const CAP_DAILY_OVERSPEND = -15; // most negative allowed from this event type / month

export const POINTS_STREAK_MILESTONE = 5;
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90] as const;

/** Incomplete "today" never breaks a streak; plus this many miss days may be absorbed. */
export const STREAK_GRACE_FREEZES_PER_MONTH = 1;

/** How many past UTC days (ending yesterday) a single /rollover/run may catch up. */
export const ROLLOVER_CATCHUP_DAYS = 7;
