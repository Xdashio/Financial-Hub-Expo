/**
 * Batch 7 notification kinds. Each maps to a preference toggle so the
 * scheduler / event hooks can gate delivery without hard-coding strings
 * across services.
 */
export const NOTIFICATION_KIND = {
  STREAK_MILESTONE: 'streak_milestone',
  ROLLOVER_SUCCESS: 'rollover_success',
  COOLING_OFF_READY: 'cooling_off_ready',
  REALLOCATION_CONFIRM: 'reallocation_confirm',
  STREAK_AT_RISK: 'streak_at_risk',
  MONTHLY_INSIGHT: 'monthly_insight',
  ALLOCATION_RECEIVED: 'allocation_received',
} as const;

export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND];

export type PreferenceKey =
  | 'reallocation_confirms'
  | 'cooling_off_reminders'
  | 'savings_milestones'
  | 'monthly_insights'
  | 'tips_nudges';

/** Which preference toggle must be ON for a given kind to send. */
export const KIND_PREFERENCE: Record<NotificationKind, PreferenceKey> = {
  [NOTIFICATION_KIND.STREAK_MILESTONE]: 'savings_milestones',
  [NOTIFICATION_KIND.ROLLOVER_SUCCESS]: 'savings_milestones',
  [NOTIFICATION_KIND.COOLING_OFF_READY]: 'cooling_off_reminders',
  [NOTIFICATION_KIND.REALLOCATION_CONFIRM]: 'reallocation_confirms',
  [NOTIFICATION_KIND.STREAK_AT_RISK]: 'tips_nudges',
  [NOTIFICATION_KIND.MONTHLY_INSIGHT]: 'monthly_insights',
  // Allocation confirmations share the savings_milestones toggle — the
  // settings copy covers rollover + allocation celebrations together.
  [NOTIFICATION_KIND.ALLOCATION_RECEIVED]: 'savings_milestones',
};

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  reallocation_confirms: true,
  cooling_off_reminders: true,
  savings_milestones: true,
  monthly_insights: false,
  tips_nudges: false,
} as const;

/**
 * How far past cooling_off_ends_at we still send a "ready" reminder.
 * Wide enough that a short API outage / deploy doesn't permanently miss
 * the window (local schedules still cover the foreground device).
 */
export const COOLING_OFF_REMINDER_GRACE_MS = 6 * 60 * 60 * 1000;

/** Expo Push API endpoint. */
export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
