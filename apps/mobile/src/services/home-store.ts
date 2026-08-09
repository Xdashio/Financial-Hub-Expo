import { create } from 'zustand';
import { pocketsApi, insightsApi } from '@/services/api';

export interface Pocket {
  id: string;
  name: string;
  kind: 'savings' | 'fixed' | 'spendable';
  category?: string;
  monthlyAllocation: number;
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

// Note: transaction/spend tracking is out of scope for the MVP showcase, so
// there's no real spend data to compute "remaining" against yet. Until this
// exists, the full daily cap is shown as remaining with 0% of it spent.
function calculateDailyPockets(pockets: Pocket[]): DailyPocket[] {
  const spendablePockets = pockets.filter(p => p.kind === 'spendable');
  return spendablePockets.map(pocket => {
    const dailyCap = pocket.dailyCap || 0;
    return {
      id: pocket.id,
      name: pocket.name,
      color: POCKET_COLORS[pocket.category || 'food'] || POCKET_COLORS.food,
      category: pocket.category,
      remaining: Math.round(dailyCap),
      cap: Math.round(dailyCap),
      progress: 0, // No spend tracked yet — full cap available
    };
  });
}

// No spend tracking yet, so nothing has ever gone unspent to roll over.
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

function calculateSafeToSpend(pockets: Pocket[]): number {
  const spendablePockets = pockets.filter(p => p.kind === 'spendable');
  const hasDailyCap = spendablePockets.some(p => (p.dailyCap ?? 0) > 0);

  if (hasDailyCap) {
    return spendablePockets.reduce((sum, p) => sum + (p.dailyCap || 0), 0);
  }

  // Structured plans don't set a daily_cap on spendable pockets (it's always
  // null — see onboarding.service.ts), so summing dailyCap always came out
  // to 0 and "Safe to spend" showed empty. For structured plans, fall back
  // to the total spendable allocation instead.
  return spendablePockets.reduce((sum, p) => sum + (p.monthlyAllocation || 0), 0);
}

function calculateTotalBalance(pockets: Pocket[]): number {
  return pockets.reduce((sum, p) => sum + p.monthlyAllocation, 0);
}

// The API returns pocket rows straight from the DB in snake_case
// (daily_cap, monthly_allocation, is_time_locked, lock_until); the store's
// Pocket interface uses camelCase, so map between the two here.
function mapPocket(raw: any): Pocket {
  return {
    id: raw.id,
    name: raw.name,
    kind: raw.kind,
    category: raw.category,
    monthlyAllocation: raw.monthly_allocation,
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
    disciplineScore: 87,
    scoreDelta: 3,
    isLoading: false,
    error: null,

    fetchHomeData: async () => {
      set({ isLoading: true, error: null });
      try {
        const [pocketsRes, insightsRes] = await Promise.all([
          pocketsApi.getAll(),
          insightsApi.getDisciplineScore(),
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
          disciplineScore: insightsRes?.score || 87,
          scoreDelta: insightsRes?.delta || 3,
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