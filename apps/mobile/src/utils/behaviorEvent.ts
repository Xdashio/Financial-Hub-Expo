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
  return { title: String(event.type ?? 'Activity').replace(/_/g, ' '), desc: '', time, color: colors.sage };
}