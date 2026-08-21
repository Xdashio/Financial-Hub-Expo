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

  if (event.type === 'plan_created') {
    return { title: 'Plan assigned', desc: 'Your money plan is ready', time, color: colors.gold };
  }
  if (event.type === 'reallocation_completed') {
    const desc = payload.amount && payload.fromPocket && payload.toPocket
      ? `Moved ${payload.amount} from ${payload.fromPocket} → ${payload.toPocket}`
      : 'Funds moved between pockets';
    return { title: payload.disciplineCost > 0 ? 'Reallocation (skipped cooling-off)' : 'Reallocation', desc, time, color: colors.plum };
  }
  // Logged when a move is first requested, separately from
  // reallocation_completed (which fires once cooling-off finishes or is
  // skipped). Without an explicit case here this fell through to the
  // generic fallback below and printed the raw "reallocation initiated"
  // type right under the completed entry, reading like a stray duplicate.
  if (event.type === 'reallocation_initiated') {
    const desc = payload.amount && payload.fromPocket && payload.toPocket
      ? `Requested moving ${payload.amount} from ${payload.fromPocket} → ${payload.toPocket}`
      : 'A pocket move was requested';
    return { title: payload.status === 'cooling_off' ? 'Reallocation started (cooling-off)' : 'Reallocation requested', desc, time, color: colors.sage };
  }
  if (event.type === 'early_unlock') {
    const desc = payload.points_deducted ? `−${payload.points_deducted} discipline points` : 'Savings unlocked early';
    return { title: 'Early unlock', desc, time, color: colors.clay };
  }
  // Matches the event type actually written by PocketsService.extendLock
  // ('lock_extension', not 'lock_extended') — the mismatch previously sent
  // every lock-extension event to the generic fallback below, silently
  // dropping the "+X discipline points" explanation it was written to show.
  if (event.type === 'lock_extension') {
    const desc = payload.points_added ? `+${payload.points_added} discipline points` : 'Lock extended';
    return { title: 'Lock extended', desc, time, color: colors.emerald };
  }
  if (event.type === 'daily_rollover_success') {
    // Hide events with zero amount to avoid showing fake "KES 0 to Savings" for new users
    if (payload.amount === 0 || payload.amount == null) {
      return null;
    }
    const amount = `${formatMoney(Number(payload.amount))} to Savings`;
    const pts = payload.points_added ? ` · +${payload.points_added} pts` : '';
    return { title: 'Daily rollover', desc: `${amount}${pts}`, time, color: colors.emerald };
  }
  if (event.type === 'daily_overspend') {
    const pts = payload.points_deducted ? `−${payload.points_deducted} discipline points` : 'Went over a daily cap';
    return { title: 'Over daily cap', desc: pts, time, color: colors.clay };
  }
  if (event.type === 'streak_milestone') {
    const desc = payload.days ? `${payload.days}-day under-cap streak` : 'Streak milestone';
    return { title: 'Streak milestone', desc, time, color: colors.emerald };
  }
  if (event.type === 'streak_freeze_used') {
    return { title: 'Streak freeze used', desc: 'A missed day was covered by your freeze', time, color: colors.gold };
  }
  if (typeof event.type === 'string' && event.type.startsWith('savings_streak')) {
    const desc = payload.days ? `${payload.days} days without touching Savings pocket` : 'Savings streak continues';
    return { title: 'Savings streak', desc, time, color: colors.emerald };
  }
  // Fixed-expense paid before/on its due_day (rollover.constants.ts
  // EVENT_FIXED_PAYMENT_ON_TIME, +POINTS_FIXED_PAYMENT_ON_TIME). Previously
  // had no case here, so it fell through to the generic fallback below and
  // showed as a bare, colorless "fixed payment on time" with no points —
  // even though it's counted in the period's discipline delta.
  if (event.type === 'fixed_payment_on_time') {
    const desc = payload.points_added ? `+${payload.points_added} discipline points` : 'Paid a fixed expense on time';
    return { title: 'Fixed expense paid on time', desc, time, color: colors.emerald };
  }
  // Savings/spend goal reached (rollover.constants.ts EVENT_GOAL_ACHIEVED).
  // Same gap as above — no case meant no visible points for a genuine win.
  if (event.type === 'goal_achieved') {
    const desc = payload.points_added ? `+${payload.points_added} discipline points` : 'Reached a savings goal';
    return { title: 'Goal achieved', desc, time, color: colors.emerald };
  }
  // A spend against a known-gambling recipient was blocked and the user
  // tried again anyway (rollover.constants.ts EVENT_GAMBLING_BLOCKED_ATTEMPT,
  // -POINTS_GAMBLING_BLOCKED_ATTEMPT). Previously fell through to the
  // fallback, which hid both the point cost and why it happened.
  if (event.type === 'gambling_blocked_attempt') {
    const desc = payload.points_deducted ? `−${payload.points_deducted} discipline points` : 'Blocked spend to a gambling recipient';
    return { title: 'Gambling attempt blocked', desc, time, color: colors.clay };
  }
  // User deliberately spent past a pocket's available balance via the
  // explicit override path (rollover.constants.ts EVENT_ESSENTIAL_OVERRIDE,
  // -POINTS_ESSENTIAL_OVERRIDE) — the steepest single-event penalty. Same
  // gap: no case meant this, the single costliest logged action, was the
  // least visible one in the activity list.
  if (event.type === 'essential_override') {
    const desc = payload.points_deducted ? `−${payload.points_deducted} discipline points` : 'Spent past a pocket\u2019s available balance';
    return { title: 'Spend override', desc, time, color: colors.clay };
  }

  // Loan repayment made on/before its due date (loans.service.ts
  // repayLoan, +5 via applyDelta). Previously had no case here *and* the
  // event's own payload carried no points_added — see insights.service.ts
  // for the matching backend-side fix — so this was invisible both in the
  // period point total and in this activity list.
  if (event.type === 'loan_repayment_ontime') {
    const desc = payload.points_added ? `+${payload.points_added} discipline points` : 'Loan repayment made on time';
    return { title: 'Loan repayment on time', desc, time, color: colors.emerald };
  }
  // Loan repayment made after its due date (loans.service.ts repayLoan,
  // -3 via applyDelta). Same visibility gap as above.
  if (event.type === 'loan_repayment_late') {
    const desc = payload.points_deducted ? `−${payload.points_deducted} discipline points` : 'Loan repayment was late';
    return { title: 'Loan repayment late', desc, time, color: colors.clay };
  }
  // Loan fully paid off (loans.service.ts markLoanFullyRepaid, +10 via
  // applyDelta) — the single largest positive event in the app. Same gap.
  if (event.type === 'loan_fully_repaid') {
    const desc = payload.points_added ? `+${payload.points_added} discipline points` : 'Loan fully repaid';
    return { title: 'Loan paid off', desc, time, color: colors.gold };
  }

  // Generic fallback for any event type without an explicit case above.
  // Rather than silently dropping the point movement (the bug behind the
  // four cases just added — each one carried points_added/points_deducted
  // in its payload the whole time, just nothing here read it), fall back
  // to reading the same points_added/points_deducted convention every
  // other case follows. This also future-proofs new event types: a
  // scoring event that starts writing points but hasn't gotten a bespoke
  // case yet still shows its point movement instead of going blank.
  const title = String(event.type ?? 'Activity').replace(/_/g, ' ');
  if (typeof payload.points_added === 'number' && payload.points_added > 0) {
    return { title, desc: `+${payload.points_added} discipline points`, time, color: colors.emerald };
  }
  if (typeof payload.points_deducted === 'number' && payload.points_deducted > 0) {
    return { title, desc: `−${payload.points_deducted} discipline points`, time, color: colors.clay };
  }
  return { title, desc: '', time, color: colors.sage };
}