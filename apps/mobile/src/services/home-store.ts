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
  name: string;
  color: string;
  remaining: number;
  cap: number;
  progress: number;
}

export interface HomeState {
  pockets: Pocket[];
  dailyPockets: DailyPocket[];
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

function calculateDailyPockets(pockets: Pocket[]): DailyPocket[] {
  const spendablePockets = pockets.filter(p => p.kind === 'spendable');
  return spendablePockets.map(pocket => {
    const dailyCap = pocket.dailyCap || 0;
    const remaining = dailyCap * 0.7; // Placeholder - in real app, calculate from transactions
    return {
      name: pocket.name,
      color: POCKET_COLORS[pocket.category || 'food'] || POCKET_COLORS.food,
      remaining: Math.round(remaining),
      cap: Math.round(dailyCap),
      progress: dailyCap > 0 ? 1 - (remaining / dailyCap) : 0,
    };
  });
}

function calculateRollover(pockets: Pocket[]): number {
  // In real app, calculate from actual daily spending vs caps
  return 140;
}

function calculateSafeToSpend(pockets: Pocket[]): number {
  const spendablePockets = pockets.filter(p => p.kind === 'spendable');
  return spendablePockets.reduce((sum, p) => sum + (p.dailyCap || 0), 0);
}

function calculateTotalBalance(pockets: Pocket[]): number {
  return pockets.reduce((sum, p) => sum + p.monthlyAllocation, 0);
}

export const useHomeStore = create<HomeState>()(
  (set, get) => ({
    pockets: [],
    dailyPockets: [],
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
        
        const pockets = pocketsRes || [];
        const dailyPockets = calculateDailyPockets(pockets);
        const rolloverAmount = calculateRollover(pockets);
        const safeToSpendToday = calculateSafeToSpend(pockets);
        const totalBalance = calculateTotalBalance(pockets);
        
        set({
          pockets,
          dailyPockets,
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