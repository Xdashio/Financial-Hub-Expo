import { create } from 'zustand';
import { api } from '@/services/api';

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

export const useFixedExpensesStore = create<FixedExpensesState>((set, get) => ({
  expenses: [],
  isLoading: false,
  error: null,

  fetchExpenses: async () => {
    try {
      set({ isLoading: true, error: null });
      const data = await api.get<any[]>('/profile/fixed-expenses');
      set({ expenses: data, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load expenses',
        isLoading: false 
      });
    }
  },

  addExpense: async (expenseData) => {
    const { expenses: previousExpenses } = get();
    
    try {
      // Optimistic update
      const optimisticExpense: FixedExpense = {
        ...expenseData,
        id: `temp-${Date.now()}`,
        user_id: 'current',
        created_at: new Date().toISOString(),
      };
      set({ expenses: [...previousExpenses, optimisticExpense] });

      // Actual API call
      const created = await api.post<any>('/profile/fixed-expenses', expenseData);
      
      // Replace optimistic with real data. Bug fix (senior review,
      // 2026-08-13): this previously mapped over the `expenses` closure
      // variable captured *before* the optimistic update above, which
      // never contained optimisticExpense — so the id match always missed,
      // and this set() silently reverted the store to the pre-add list,
      // dropping the newly created expense from the UI right after a
      // successful save. Read current state fresh via get() instead.
      set({
        expenses: get().expenses.map(e => (e.id === optimisticExpense.id ? created : e)),
      });
    } catch (error) {
      // Rollback on error
      set({ expenses: previousExpenses });
      throw error;
    }
  },

  updateExpense: async (id, updates) => {
    const { expenses } = get();
    const previousExpenses = [...expenses];

    try {
      // Optimistic update
      set({ 
        expenses: expenses.map(e => e.id === id ? { ...e, ...updates } : e)
      });

      // Actual API call
      await api.put<any>(`/profile/fixed-expenses/${id}`, updates);
      
      // Refresh to get server state
      const data = await api.get<any[]>('/profile/fixed-expenses');
      set({ expenses: data });
    } catch (error) {
      // Rollback on error
      set({ expenses: previousExpenses });
      throw error;
    }
  },

  deleteExpense: async (id) => {
    const { expenses } = get();
    const previousExpenses = [...expenses];

    try {
      // Optimistic update
      set({ expenses: expenses.filter(e => e.id !== id) });

      // Actual API call
      await api.delete<void>(`/profile/fixed-expenses/${id}`);
      
      // Keep the optimistic state (already deleted)
    } catch (error) {
      // Rollback on error
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