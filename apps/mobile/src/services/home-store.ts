import { create } from 'zustand';
import { pocketsApi, insightsApi } from '@/services/api';
import { RunwaySummary } from '@financial-hub/shared';

export interface Pocket {
  id: string;
  name: string;
  kind: 'savings' | 'fixed' | 'spendable';
  category?: string;
  monthlyAllocation: number; // planning ceiling set at onboarding — not a live balance
  availableBalance: number;  // ledger-derived: allocation credits - spend debits - reallocation outflows
  dailyCap?: number;
  isTimeLocked?: boolean;
  lockUntil?: string;
}

export interface DailyPocket {
  id: string;
  name: string;
  color: string;
  category?: string;
  remaining: number;
  cap: number;
  progress: number;
}

export interface HomeState {
  pockets: Pocket[];
  dailyPockets: DailyPocket[];
  planType: 'daily' | 'structured';
  rolloverAmount: number;
  safeToSpendToday: number;
  totalBalance: number;
  disciplineScore: number;
  scoreDelta: number;
  // { applicable: false } for salaried/mix/structured plans — home screen
  // should only render runway UI when applicable is true. See
  // docs/FREELANCER_RUNWAY.md.
  runway: RunwaySummary;
  isLoading: boolean;
  error: string | null;
  
  fetchHomeData: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const POCKET_COLORS: Record<string, string> = {
  food: '#1F5F4E',
  transport: '#8A6FB0',
  leisure: '#C4622D',
  savings: '#153F34',
  fixed: '#B8873A',
};

// Daily pockets show remaining available balance for the day.
// For daily-plan pockets the cap is daily_cap; for structured-plan pockets
// the cap is the monthly allocation ceiling. The remaining is always the
// ledger-derived available_balance (real money in the pocket).
function calculateDailyPockets(pockets: Pocket[]): DailyPocket[] {
  const spendablePockets = pockets.filter(p => p.kind === 'spendable');
  return spendablePockets.map(pocket => {
    const cap = pocket.dailyCap ?? pocket.monthlyAllocation;
    const remaining = pocket.availableBalance;
    const progress = cap > 0 ? Math.max(0, Math.min(1, 1 - remaining / cap)) : 0;
    return {
      id: pocket.id,
      name: pocket.name,
      color: POCKET_COLORS[pocket.category || 'food'] || POCKET_COLORS.food,
      category: pocket.category,
      remaining: Math.round(remaining),
      cap: Math.round(cap),
      progress,
    };
  });
}

// Rollover is the sum of unspent spendable balance from the previous period.
// This is a future feature — no period boundary logic exists yet.
function calculateRollover(): number {
  return 0;
}

// Daily-plan pockets carry a positive daily_cap; structured-plan pockets
// have daily_cap === null. If any spendable pocket has a cap, treat the
// whole plan as "daily".
function derivePlanType(pockets: Pocket[]): 'daily' | 'structured' {
  const hasDailyCap = pockets.some(p => p.kind === 'spendable' && (p.dailyCap ?? 0) > 0);
  return hasDailyCap ? 'daily' : 'structured';
}

// Safe to spend is the total ledger-derived available balance across all
// spendable pockets — i.e. real money the user can actually spend today.
function calculateSafeToSpend(pockets: Pocket[]): number {
  return pockets
    .filter(p => p.kind === 'spendable')
    .reduce((sum, p) => sum + p.availableBalance, 0);
}

// Total balance is the sum of available_balance across all pockets — the
// user's real money across fixed, savings, and spendable.
function calculateTotalBalance(pockets: Pocket[]): number {
  return pockets.reduce((sum, p) => sum + p.availableBalance, 0);
}

// The API returns enriched pocket rows in snake_case; map to camelCase here.
// available_balance is the ledger-derived spendable balance (allocation
// credits minus spend debits and reallocation outflows).
// monthly_allocation is the planning ceiling set at onboarding — kept for
// percentage displays and daily cap calculations, not for balance.
function mapPocket(raw: any): Pocket {
  return {
    id: raw.id,
    name: raw.name,
    kind: raw.kind,
    category: raw.category,
    monthlyAllocation: raw.monthly_allocation,
    availableBalance: raw.available_balance ?? 0,
    dailyCap: raw.daily_cap ?? undefined,
    isTimeLocked: raw.is_time_locked,
    lockUntil: raw.lock_until ?? undefined,
  };
}

export const useHomeStore = create<HomeState>()(
  (set, get) => ({
    pockets: [],
    dailyPockets: [],
    planType: 'daily',
    rolloverAmount: 0,
    safeToSpendToday: 0,
    totalBalance: 0,
    // Matches the backend's DEFAULT_DISCIPLINE_SCORE (insights.service.ts) —
    // every user starts at 100 and loses points for things like skipping a
    // cooling-off or unlocking savings early. The old placeholder (87/3)
    // wasn't the real base value, and using `||` below meant a genuinely
    // earned score of 0 would incorrectly redisplay as that placeholder.
    disciplineScore: 100,
    scoreDelta: 0,
    runway: { applicable: false },
    isLoading: false,
    error: null,

    fetchHomeData: async () => {
      set({ isLoading: true, error: null });
      try {
        const [pocketsRes, insightsRes, runwayRes] = await Promise.all([
          pocketsApi.getAll(),
          insightsApi.getDisciplineScore(),
          // Cheap for salaried/mix/structured plans (returns { applicable:
          // false } immediately) so it's safe to always fetch rather than
          // branching on plan type client-side. See docs/FREELANCER_RUNWAY.md.
          pocketsApi.getRunway().catch(() => ({ applicable: false } as RunwaySummary)),
        ]);
        
        const pockets = (pocketsRes || []).map(mapPocket);
        const dailyPockets = calculateDailyPockets(pockets);
        const planType = derivePlanType(pockets);
        const rolloverAmount = calculateRollover();
        const safeToSpendToday = calculateSafeToSpend(pockets);
        const totalBalance = calculateTotalBalance(pockets);
        
        set({
          pockets,
          dailyPockets,
          planType,
          rolloverAmount,
          safeToSpendToday,
          totalBalance,
          // `??` not `||` — a real score/delta of 0 is a valid value and
          // must not be silently replaced by the fallback.
          disciplineScore: insightsRes?.score ?? 100,
          scoreDelta: insightsRes?.delta ?? 0,
          runway: runwayRes || { applicable: false },
          isLoading: false,
        });
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to load home data', 
          isLoading: false 
        });
      }
    },

    refreshData: async () => {
      await get().fetchHomeData();
    },
  })
);