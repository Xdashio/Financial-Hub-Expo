import { create } from 'zustand';
import { api, pocketsApi, profileApi } from '@/services/api';
import { useHomeStore } from '@/services/home-store';
import { useDataSync } from '@/services/data-sync';

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  category: string;
  user_id: string;
  created_at: string;
}

export interface FixedExpensesState {
  expenses: FixedExpense[];
  isLoading: boolean;
  error: string | null;

  fetchExpenses: () => Promise<void>;
  addExpense: (expense: Omit<FixedExpense, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  updateExpense: (id: string, updates: Partial<FixedExpense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  
  // Optimistic update helpers
  optimisticAdd: (expense: FixedExpense) => void;
  optimisticUpdate: (id: string, updates: Partial<FixedExpense>) => void;
  optimisticDelete: (id: string) => void;
}

/** API schema wants dueDay; the form historically posted due_day. */
function toApiBody(expense: Partial<FixedExpense> & { name?: string; amount?: number; category?: string }) {
  const body: Record<string, unknown> = { ...expense };
  if (body.dueDay === undefined && typeof body.due_day === 'number') {
    body.dueDay = body.due_day;
    delete body.due_day;
  }
  delete body.id;
  delete body.user_id;
  delete body.created_at;
  return body;
}

function fixedExpenseNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function createdAtValue(expense: FixedExpense): number {
  const parsed = Date.parse(expense.created_at ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function isNewerFixedExpense(candidate: FixedExpense, current: FixedExpense): boolean {
  const candidateTime = createdAtValue(candidate);
  const currentTime = createdAtValue(current);
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  return candidate.id > current.id;
}

/**
 * Legacy rows can still contain several copies of the same bill until
 * migration 044 is applied. Show one row per name, keeping the newest copy,
 * so the list and its total stay correct in the meantime.
 */
function dedupeFixedExpenses(expenses: FixedExpense[]): FixedExpense[] {
  const byName = new Map<string, FixedExpense>();
  for (const expense of expenses) {
    const key = fixedExpenseNameKey(expense.name);
    const current = byName.get(key);
    if (!current || isNewerFixedExpense(expense, current)) {
      byName.set(key, expense);
    }
  }
  return Array.from(byName.values());
}

function matchFixedPocket(
  pockets: Array<{ id: string; name: string; kind: string; category?: string | null; availableBalance?: number; available_balance?: number }>,
  name: string,
  category?: string,
) {
  const fixed = pockets.filter((p) => p.kind === 'fixed');
  const normalized = name.trim().toLowerCase();
  const byName = fixed.filter((p) => p.name.trim().toLowerCase() === normalized);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1 && category) {
    return byName.find((p) => p.category === category) ?? byName[0];
  }
  if (category) {
    const byCat = fixed.filter((p) => p.category === category);
    if (byCat.length === 1) return byCat[0];
  }
  if (fixed.length === 1) return fixed[0];
  return undefined;
}

export function getFixedPocketBalance(
  pockets: Array<{ id: string; name: string; kind: string; category?: string | null; availableBalance?: number; available_balance?: number }>,
  name: string,
  category?: string,
): number {
  const match = matchFixedPocket(pockets, name, category);
  if (!match) return 0;
  return match.availableBalance ?? match.available_balance ?? 0;
}

/**
 * Homepage Fixed & Protected reads pockets, not fixed_expenses. Dual-write
 * the pocket name via PUT /pockets/:id so rename works even when the profile
 * sync path isn't deployed yet on Railway.
 */
async function syncHomepagePocket(opts: {
  previousName: string;
  previousCategory?: string;
  nextName: string;
  nextCategory: string;
  nextAmount?: number;
}) {
  try {
    const pockets = await pocketsApi.getAll();
    const match = matchFixedPocket(
      pockets,
      opts.previousName,
      opts.previousCategory ?? opts.nextCategory,
    );
    if (!match) return;

    await pocketsApi.update(match.id, {
      name: opts.nextName,
      category: opts.nextCategory,
    });
    useHomeStore.getState().updatePocketLocal(match.id, {
      name: opts.nextName,
      category: opts.nextCategory,
      ...(typeof opts.nextAmount === 'number'
        ? { monthlyAllocation: opts.nextAmount }
        : {}),
    });
    useDataSync.getState().bump();
  } catch (err) {
    console.warn('Failed to sync fixed pocket to homepage:', err);
  }
}

export const useFixedExpensesStore = create<FixedExpensesState>((set, get) => ({
  expenses: [],
  isLoading: false,
  error: null,

  fetchExpenses: async () => {
    try {
      set({ isLoading: true, error: null });
      // Always scope to the individual segment: an unfiltered request also
      // returned MSME bills, which inflated this screen's list and total.
      const data = await profileApi.getFixedExpenses('individual');
      set({
        expenses: dedupeFixedExpenses(Array.isArray(data) ? data : []),
        isLoading: false,
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load expenses',
        isLoading: false 
      });
    }
  },

  addExpense: async (expenseData) => {
    const { expenses: previousExpenses } = get();
    const trimmedName = expenseData.name.trim();
    if (!trimmedName) {
      throw new Error('Name is required');
    }
    if (
      previousExpenses.some(
        (e) => fixedExpenseNameKey(e.name) === fixedExpenseNameKey(trimmedName),
      )
    ) {
      throw new Error('A fixed expense with this name already exists');
    }
    const nextExpense = { ...expenseData, name: trimmedName };
    
    try {
      const optimisticExpense: FixedExpense = {
        ...nextExpense,
        id: `temp-${Date.now()}`,
        user_id: 'current',
        created_at: new Date().toISOString(),
      };
      set({ expenses: [...previousExpenses, optimisticExpense] });

      const created = await api.post<any>('/profile/fixed-expenses', toApiBody(nextExpense));
      
      set((state) => {
        const hasOptimisticRow = state.expenses.some((e) => e.id === optimisticExpense.id);
        if (hasOptimisticRow) {
          return {
            expenses: state.expenses.map((e) => (e.id === optimisticExpense.id ? created : e)),
          };
        }
        // A focus refresh can replace the optimistic row before the POST
        // resolves. Append the persisted row instead of silently losing it.
        return { expenses: dedupeFixedExpenses([...state.expenses, created]) };
      });

      await syncHomepagePocket({
        previousName: nextExpense.name,
        previousCategory: nextExpense.category,
        nextName: nextExpense.name,
        nextCategory: nextExpense.category,
        nextAmount: nextExpense.amount,
      });
    } catch (error) {
      set({ expenses: previousExpenses });
      throw error;
    }
  },

  updateExpense: async (id, updates) => {
    const { expenses } = get();
    const previousExpenses = [...expenses];
    const existing = expenses.find((e) => e.id === id);
    const trimmedName = updates.name?.trim();

    if (updates.name !== undefined && !trimmedName) {
      throw new Error('Name is required');
    }
    if (
      trimmedName &&
      expenses.some(
        (e) => e.id !== id && fixedExpenseNameKey(e.name) === fixedExpenseNameKey(trimmedName),
      )
    ) {
      throw new Error('A fixed expense with this name already exists');
    }
    const nextUpdates = trimmedName ? { ...updates, name: trimmedName } : updates;

    try {
      set({ 
        expenses: expenses.map(e => e.id === id ? { ...e, ...nextUpdates } : e)
      });

      await api.put<any>(`/profile/fixed-expenses/${id}`, toApiBody(nextUpdates));
      
      const data = await profileApi.getFixedExpenses('individual');
      set({ expenses: dedupeFixedExpenses(Array.isArray(data) ? data : []) });

      if (existing) {
        const nextName = nextUpdates.name ?? existing.name;
        const nextCategory = nextUpdates.category ?? existing.category;
        const nextAmount = nextUpdates.amount ?? existing.amount;
        await syncHomepagePocket({
          previousName: existing.name,
          previousCategory: existing.category,
          nextName,
          nextCategory,
          nextAmount,
        });
      }
    } catch (error) {
      set({ expenses: previousExpenses });
      throw error;
    }
  },

  deleteExpense: async (id) => {
    const { expenses } = get();
    const previousExpenses = [...expenses];
    const existing = expenses.find((e) => e.id === id);

    try {
      set({ expenses: expenses.filter(e => e.id !== id) });

      await api.delete<void>(`/profile/fixed-expenses/${id}`);

      // Optimistically drop the matching homepage card. The API also removes
      // the pocket (unlock + optional balance move to Savings); refresh
      // reconciles if that path isn't deployed yet.
      if (existing) {
        useHomeStore.setState((state) => {
          const match = matchFixedPocket(state.pockets, existing.name, existing.category);
          if (!match) return state;
          return {
            pockets: state.pockets.filter((p) => p.id !== match.id),
            dailyPockets: state.dailyPockets.filter((p) => p.id !== match.id),
          };
        });
      }

      useDataSync.getState().bump();
      await useHomeStore.getState().refreshData().catch(() => undefined);
    } catch (error) {
      set({ expenses: previousExpenses });
      throw error;
    }
  },

  optimisticAdd: (expense) => {
    const { expenses } = get();
    set({ expenses: [...expenses, expense] });
  },

  optimisticUpdate: (id, updates) => {
    const { expenses } = get();
    set({ 
      expenses: expenses.map(e => e.id === id ? { ...e, ...updates } : e)
    });
  },

  optimisticDelete: (id) => {
    const { expenses } = get();
    set({ expenses: expenses.filter(e => e.id !== id) });
  },
}));
