import { formatMoney } from '@/utils/money';
// Formats a raw behavior_events row (type + payload) into something
// displayable. Previously this lived only inside (tabs)/insights.tsx, which
// meant the heatmap's tap-to-expand day panel (StreakHeatmap.tsx) had no way
// to show what an event actually was — it could only show the aggregate
// count/points for the day. Extracting it here lets both places render the
// same real descriptions instead of the heatmap needing its own (and
// inevitably drifting) copy.

export interface DisplayEvent {
  title: string;
  desc: string;
  time: string;
  color: string;
}

export type DisplayEventOrNull = DisplayEvent | null;

// Exhaustive list of behavior event types written by the backend (fixed literal types).
// Must be kept in sync with insights.service.ts sumPeriodDisciplinePoints
// and any new event types added to the backend.
// savings_streak events are dynamic (savings_streak_7, savings_streak_30, etc.)
// and handled separately via prefix check.
export type BehaviorEventType =
  | 'plan_created'
  | 'reallocation_completed'
  | 'reallocation_initiated'
  | 'early_unlock'
  | 'lock_extension'
  | 'daily_rollover_success'
  | 'daily_overspend'
  | 'streak_milestone'
  | 'streak_freeze_used'
  | 'fixed_payment_on_time'
  | 'goal_achieved'
  | 'gambling_blocked_attempt'
  | 'essential_override'
  | 'loan_repayment_ontime'
  | 'loan_repayment_late'
  | 'loan_fully_repaid';

function assertNever(x: never): never {
  throw new Error(`Unhandled behavior event type: ${x}`);
}

function isSavingsStreak(type: string): type is `savings_streak${string}` {
  return type.startsWith('savings_streak');
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
}

export function mapBehaviorEvent(event: any, colors: any): DisplayEventOrNull {
  const payload = event.payload || {};
  const time = formatRelativeTime(event.created_at);
  const type = event.type as string;

  // Savings streak events have dynamic names (savings_streak_7, savings_streak_30, etc.)
  // Handle them first via prefix check.
  if (isSavingsStreak(type)) {
    const desc = payload.days ? `${payload.days} days without touching Savings pocket` : 'Savings streak continues';
    return { title: 'Savings streak', desc, time, color: colors.emerald };
  }

  // Exhaustive switch on fixed literal types. assertNever in default ensures
  // compile-time exhaustiveness — adding a new event type to BehaviorEventType
  // without a case here will cause a type error.
  const fixedType = type as BehaviorEventType;
  switch (fixedType) {
    case 'plan_created': {
      return { title: 'Plan assigned', desc: 'Your money plan is ready', time, color: colors.gold };
    }
    case 'reallocation_completed': {
      const desc = payload.amount && payload.fromPocket && payload.toPocket
        ? `Moved ${payload.amount} from ${payload.fromPocket} → ${payload.toPocket}`
        : 'Funds moved between pockets';
      return { title: payload.disciplineCost > 0 ? 'Reallocation (skipped cooling-off)' : 'Reallocation', desc, time, color: colors.plum };
    }
    case 'reallocation_initiated': {
      const desc = payload.amount && payload.fromPocket && payload.toPocket
        ? `Requested moving ${payload.amount} from ${payload.fromPocket} → ${payload.toPocket}`
        : 'A pocket move was requested';
      return { title: payload.status === 'cooling_off' ? 'Reallocation started (cooling-off)' : 'Reallocation requested', desc, time, color: colors.sage };
    }
    case 'early_unlock': {
      const desc = payload.points_deducted ? `−${payload.points_deducted} discipline points` : 'Savings unlocked early';
      return { title: 'Early unlock', desc, time, color: colors.clay };
    }
    case 'lock_extension': {
      const desc = payload.points_added ? `+${payload.points_added} discipline points` : 'Lock extended';
      return { title: 'Lock extended', desc, time, color: colors.emerald };
    }
    case 'daily_rollover_success': {
      // Hide events with zero amount to avoid showing fake "KES 0 to Savings" for new users
      if (payload.amount === 0 || payload.amount == null) {
        return null;
      }
      const amount = `${formatMoney(Number(payload.amount))} to Savings`;
      const pts = payload.points_added ? ` · +${payload.points_added} pts` : '';
      return { title: 'Daily rollover', desc: `${amount}${pts}`, time, color: colors.emerald };
    }
    case 'daily_overspend': {
      const pts = payload.points_deducted ? `−${payload.points_deducted} discipline points` : 'Went over a daily cap';
      return { title: 'Over daily cap', desc: pts, time, color: colors.clay };
    }
    case 'streak_milestone': {
      const desc = payload.days ? `${payload.days}-day under-cap streak` : 'Streak milestone';
      return { title: 'Streak milestone', desc, time, color: colors.emerald };
    }
    case 'streak_freeze_used': {
      return { title: 'Streak freeze used', desc: 'A missed day was covered by your freeze', time, color: colors.gold };
    }
    case 'fixed_payment_on_time': {
      const desc = payload.points_added ? `+${payload.points_added} discipline points` : 'Paid a fixed expense on time';
      return { title: 'Fixed expense paid on time', desc, time, color: colors.emerald };
    }
    case 'goal_achieved': {
      const desc = payload.points_added ? `+${payload.points_added} discipline points` : 'Reached a savings goal';
      return { title: 'Goal achieved', desc, time, color: colors.emerald };
    }
    case 'gambling_blocked_attempt': {
      const desc = payload.points_deducted ? `−${payload.points_deducted} discipline points` : 'Blocked spend to a gambling recipient';
      return { title: 'Gambling attempt blocked', desc, time, color: colors.clay };
    }
    case 'essential_override': {
      const desc = payload.points_deducted ? `−${payload.points_deducted} discipline points` : 'Spent past a pocket\u2019s available balance';
      return { title: 'Spend override', desc, time, color: colors.clay };
    }
    case 'loan_repayment_ontime': {
      const desc = payload.points_added ? `+${payload.points_added} discipline points` : 'Loan repayment made on time';
      return { title: 'Loan repayment on time', desc, time, color: colors.emerald };
    }
    case 'loan_repayment_late': {
      const desc = payload.points_deducted ? `−${payload.points_deducted} discipline points` : 'Loan repayment was late';
      return { title: 'Loan repayment late', desc, time, color: colors.clay };
    }
    case 'loan_fully_repaid': {
      const desc = payload.points_added ? `+${payload.points_added} discipline points` : 'Loan fully repaid';
      return { title: 'Loan paid off', desc, time, color: colors.gold };
    }
    default: {
      assertNever(fixedType);
    }
  }
}