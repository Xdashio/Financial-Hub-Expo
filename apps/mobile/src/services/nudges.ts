import { AlertTriangle, TrendingDown, Lock, Sparkles, Calendar, PiggyBank, LucideIcon } from 'lucide-react-native';
import type { Pocket, DailyPocket } from '@/services/home-store';
import type { RunwaySummary } from '@financial-hub/shared';

export type NudgeSeverity = 'alert' | 'caution' | 'positive' | 'info';

export interface Nudge {
  id: string;
  severity: NudgeSeverity;
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  route?: string;
}

interface NudgeInput {
  pockets: Pocket[];
  dailyPockets: DailyPocket[];
  planType: 'daily' | 'structured';
  disciplineScore: number | null;
  scoreDelta: number;
  currentStreak: number;
  runway: RunwaySummary;
  rolloverAmount: number;
}

/**
 * Derives a short, prioritized list of nudges from data the home screen
 * already fetches — no separate nudges endpoint exists yet, so this reads
 * the same home-store fields the dashboard renders and turns the ones that
 * matter into short, actionable prompts. Ordered most-urgent first.
 */
export function deriveNudges(input: NudgeInput): Nudge[] {
  const { pockets, dailyPockets, planType, disciplineScore, scoreDelta, currentStreak, runway, rolloverAmount } = input;
  const nudges: Nudge[] = [];

  // Runway running low — only applicable for freelancer/daily plans.
  if (runway.applicable && typeof runway.runwayDays === 'number') {
    if (runway.runwayDays <= 3) {
      nudges.push({
        id: 'runway-critical',
        severity: 'alert',
        icon: AlertTriangle,
        title: 'Runway is running out',
        message: `About ${Math.round(runway.runwayDays)} day${runway.runwayDays === 1 ? '' : 's'} of covered spending left before your next expected income. Consider trimming discretionary pockets.`,
        actionLabel: 'Review pockets',
        route: '/(modals)/pockets-manage',
      });
    } else if (runway.runwayDays <= 7) {
      nudges.push({
        id: 'runway-low',
        severity: 'caution',
        icon: Calendar,
        title: 'Runway getting tight',
        message: `${Math.round(runway.runwayDays)} days of runway left at your current pace. Worth keeping an eye on daily spend.`,
      });
    }
  }

  // Daily pockets near or over their cap.
  const nearCapPockets = dailyPockets.filter((p) => p.cap > 0 && p.progress >= 0.85);
  if (planType === 'daily' && nearCapPockets.length > 0) {
    const worst = [...nearCapPockets].sort((a, b) => b.progress - a.progress)[0];
    const isOver = worst.remaining <= 0;
    nudges.push({
      id: `cap-${worst.id}`,
      severity: isOver ? 'alert' : 'caution',
      icon: TrendingDown,
      title: isOver ? `${worst.name} is over budget` : `${worst.name} is almost spent`,
      message: isOver
        ? `You've used all of today's ${worst.name.toLowerCase()} cap. Tomorrow resets automatically.`
        : `Only ${worst.remaining} left of today's ${worst.cap} ${worst.name.toLowerCase()} cap.`,
    });
  }

  // Time-locked savings unlocking soon (within 7 days).
  const now = Date.now();
  const soonUnlocking = pockets.filter((p) => {
    if (!p.isTimeLocked || !p.lockUntil) return false;
    const days = (new Date(p.lockUntil).getTime() - now) / 86_400_000;
    return days > 0 && days <= 7;
  });
  if (soonUnlocking.length > 0) {
    const pocket = soonUnlocking[0];
    const days = Math.max(1, Math.round((new Date(pocket.lockUntil!).getTime() - now) / 86_400_000));
    nudges.push({
      id: `unlock-${pocket.id}`,
      severity: 'info',
      icon: Lock,
      title: `${pocket.name} unlocks soon`,
      message: `Your locked savings in ${pocket.name} become available in ${days} day${days === 1 ? '' : 's'}. Decide ahead of time whether to roll it over.`,
    });
  }

  // Discipline score trending down.
  if (disciplineScore !== null && scoreDelta < 0) {
    nudges.push({
      id: 'score-drop',
      severity: 'caution',
      icon: TrendingDown,
      title: 'Discipline score dipped',
      message: `Your score dropped ${Math.abs(scoreDelta)} pts this period. Sticking to caps and avoiding early reallocations brings it back up fastest.`,
      actionLabel: 'View insights',
      route: '/(tabs)/insights',
    });
  }

  // Positive reinforcement — streaks and rollover wins are worth surfacing too,
  // not just problems, so the sheet doesn't feel like a wall of warnings.
  if (currentStreak >= 3) {
    nudges.push({
      id: 'streak',
      severity: 'positive',
      icon: Sparkles,
      title: `${currentStreak}-day discipline streak`,
      message: `You've stayed within your pockets for ${currentStreak} days straight. Keep it going.`,
    });
  }

  if (rolloverAmount > 0) {
    nudges.push({
      id: 'rollover',
      severity: 'positive',
      icon: PiggyBank,
      title: 'Yesterday\u2019s unspent cash rolled over',
      message: `${Math.round(rolloverAmount).toLocaleString()} in leftover daily budget was added to today's pockets.`,
    });
  }

  return nudges;
}