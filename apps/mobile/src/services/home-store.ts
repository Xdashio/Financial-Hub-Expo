import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pocketsApi, insightsApi, rolloverApi } from '@/services/api';
import { RunwaySummary } from '@financial-hub/shared';
import { showMilestoneCelebration, showRolloverSuccess } from '@/services/notifications';

export interface Pocket {
  id: string;
  name: string;
  kind: 'savings' | 'fixed' | 'spendable' | 'loan';
  category?: string;
  monthlyAllocation: number;
  availableBalance: number;
  dailyCap?: number;
  isTimeLocked?: boolean;
  lockUntil?: string;
  parentPocketId?: string | null;
  hasSubPockets?: boolean;
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
  disciplineScore: number | null;
  scoreDelta: number;
  currentStreak: number;
  /** Personality-driven insight card order from /insights/discipline-score. */
  cardOrder: string[];
  runway: RunwaySummary;
  isLoading: boolean;
  error: string | null;

  fetchHomeData: () => Promise<void>;
  refreshData: () => Promise<void>;
  applyOptimisticDelta: (deltas: Record<string, number>) => HomeState['pockets'];
  rollbackOptimisticUpdate: (snapshot: HomeState['pockets']) => void;
  updatePocketLocal: (id: string, patch: Partial<Pick<Pocket, 'name' | 'category' | 'dailyCap' | 'monthlyAllocation'>>) => void;
}

const POCKET_COLORS: Record<string, string> = {
  food: '#1F5F4E',
  transport: '#8A6FB0',
  leisure: '#C4622D',
  savings: '#153F34',
  fixed: '#B8873A',
};

const ROLLOVER_THROTTLE_KEY = 'rollover:lastRunUtcDate';

function calculateDailyPockets(pockets: Pocket[]): DailyPocket[] {
  const spendablePockets = pockets.filter((p) => p.kind === 'spendable');
  return spendablePockets.map((pocket) => {
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

function derivePlanType(pockets: Pocket[]): 'daily' | 'structured' {
  const hasDailyCap = pockets.some((p) => p.kind === 'spendable' && (p.dailyCap ?? 0) > 0);
  return hasDailyCap ? 'daily' : 'structured';
}

function calculateSafeToSpend(pockets: Pocket[]): number {
  return pockets
    .filter((p) => p.kind === 'spendable')
    .reduce((sum, p) => sum + p.availableBalance, 0);
}

function calculateTotalBalance(pockets: Pocket[]): number {
  return pockets.reduce((sum, p) => sum + p.availableBalance, 0);
}

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
    parentPocketId: raw.parent_pocket_id ?? null,
    hasSubPockets: raw.has_sub_pockets ?? false,
  };
}

async function runRolloverIfNeeded(): Promise<{
  latestAmount: number;
  monthToDateAmount: number;
  currentStreak: number;
}> {
  const todayUtc = new Date().toISOString().slice(0, 10);
  try {
    const lastRun = await AsyncStorage.getItem(ROLLOVER_THROTTLE_KEY);
    if (lastRun !== todayUtc) {
      const result = await rolloverApi.run();
      await AsyncStorage.setItem(ROLLOVER_THROTTLE_KEY, todayUtc);

      // Batch 7: local celebration when this device just ran rollover.
      // Server also attempts Expo push for backgrounded devices.
      if (result.milestoneAwarded != null) {
        void showMilestoneCelebration(result.milestoneAwarded);
      } else if ((result.latestAmount ?? 0) > 0) {
        void showRolloverSuccess(result.latestAmount);
      }

      const status = await rolloverApi.status().catch(() => null);
      return {
        latestAmount: result.latestAmount ?? 0,
        monthToDateAmount: status?.monthToDateAmount ?? result.totalAmount ?? 0,
        currentStreak: result.streak?.currentStreak ?? 0,
      };
    }
    const status = await rolloverApi.status();
    return {
      latestAmount: 0,
      monthToDateAmount: status.monthToDateAmount ?? 0,
      currentStreak: status.streak?.currentStreak ?? 0,
    };
  } catch {
    try {
      const status = await rolloverApi.status();
      return {
        latestAmount: 0,
        monthToDateAmount: status.monthToDateAmount ?? 0,
        currentStreak: status.streak?.currentStreak ?? 0,
      };
    } catch {
      return { latestAmount: 0, monthToDateAmount: 0, currentStreak: 0 };
    }
  }
}

export const useHomeStore = create<HomeState>()((set, get) => ({
  pockets: [],
  dailyPockets: [],
  planType: 'daily',
  rolloverAmount: 0,
  safeToSpendToday: 0,
  totalBalance: 0,
  disciplineScore: null,
  scoreDelta: 0,
  currentStreak: 0,
  cardOrder: [],
  runway: { applicable: false },
  isLoading: false,
  error: null,

  fetchHomeData: async () => {
    const hadData = get().pockets.length > 0;
    set({ isLoading: true, error: null });
    try {
      // Pockets are required; rollover/insights/runway must not take the
      // whole homepage down when Railway drops one of those connections.
      // The heavy POST /income/rollover/run is fired after the GETs so a
      // catch-up timeout cannot reset the page-load connections.
      const [pocketsOutcome, insightsOutcome, runwayOutcome, statusOutcome] = await Promise.allSettled([
        pocketsApi.getAll(),
        insightsApi.getDisciplineScore(),
        pocketsApi.getRunway(),
        rolloverApi.status(),
      ]);

      if (pocketsOutcome.status === 'rejected') {
        throw pocketsOutcome.reason;
      }

      const pockets = (pocketsOutcome.value || []).map(mapPocket);
      const dailyPockets = calculateDailyPockets(pockets);
      const planType = derivePlanType(pockets);
      const status = statusOutcome.status === 'fulfilled' ? statusOutcome.value : null;
      const insightsRes = insightsOutcome.status === 'fulfilled' ? insightsOutcome.value : null;
      const runwayRes =
        runwayOutcome.status === 'fulfilled' ? runwayOutcome.value : ({ applicable: false } as RunwaySummary);
      const previous = get();
      const safeToSpendToday = calculateSafeToSpend(pockets);
      const totalBalance = calculateTotalBalance(pockets);

      set({
        pockets,
        dailyPockets,
        planType,
        rolloverAmount: status?.monthToDateAmount ?? (hadData ? previous.rolloverAmount : 0),
        safeToSpendToday,
        totalBalance,
        disciplineScore: insightsRes?.score ?? (hadData ? previous.disciplineScore : null),
        scoreDelta: insightsRes?.delta ?? (hadData ? previous.scoreDelta : 0),
        cardOrder: Array.isArray(insightsRes?.cardOrder)
          ? insightsRes.cardOrder
          : (hadData ? previous.cardOrder : []),
        currentStreak: status?.streak?.currentStreak ?? (hadData ? previous.currentStreak : 0),
        runway: runwayRes || { applicable: false },
        isLoading: false,
        error: null,
      });

      void runRolloverIfNeeded().then((rollover) => {
        if (rollover.latestAmount > 0) {
          set({
            rolloverAmount: rollover.latestAmount,
            currentStreak: rollover.currentStreak || get().currentStreak,
          });
        }
      });
    } catch (error) {
      set({
        error: hadData ? null : error instanceof Error ? error.message : 'Failed to load home data',
        isLoading: false,
      });
    }
  },

  refreshData: async () => {
    await get().fetchHomeData();
  },

  applyOptimisticDelta: (deltas) => {
    const previous = get().pockets;
    const pockets = previous.map((p) =>
      deltas[p.id] !== undefined
        ? { ...p, availableBalance: Math.max(0, p.availableBalance + deltas[p.id]) }
        : p,
    );
    const dailyPockets = calculateDailyPockets(pockets);
    const safeToSpendToday = calculateSafeToSpend(pockets);
    const totalBalance = calculateTotalBalance(pockets);
    set({ pockets, dailyPockets, safeToSpendToday, totalBalance });
    return previous;
  },

  rollbackOptimisticUpdate: (snapshot) => {
    const pockets = snapshot;
    const dailyPockets = calculateDailyPockets(pockets);
    const safeToSpendToday = calculateSafeToSpend(pockets);
    const totalBalance = calculateTotalBalance(pockets);
    set({ pockets, dailyPockets, safeToSpendToday, totalBalance });
  },

  updatePocketLocal: (id, patch) => {
    const pockets = get().pockets.map((p) => (p.id === id ? { ...p, ...patch } : p));
    const dailyPockets = calculateDailyPockets(pockets);
    set({ pockets, dailyPockets });
  },
}));
