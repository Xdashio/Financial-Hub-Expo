import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
} from '@financial-hub/shared';
import { onboardingApi } from '@/services/onboarding';
import { profileApi } from '@/services/api';

export type OnboardingStep = 'income' | 'habits' | 'fixed' | 'result';

export interface FixedExpenseItem {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
  icon?: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Platform-aware storage adapter (mirrors the pattern in auth.ts)
const storageAdapter = {
  getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      const store = (globalThis as any).localStorage;
      return Promise.resolve(store ? store.getItem(key) : null);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      const store = (globalThis as any).localStorage;
      if (store) store.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      const store = (globalThis as any).localStorage;
      if (store) store.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

interface OnboardingState {
  currentStep: OnboardingStep;
  input: Partial<OnboardingInput>;
  fixedExpenses: FixedExpenseItem[];
  assignResult: OnboardingAssignResult | null;
  commitResult: OnboardingCommitResult | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setStep: (step: OnboardingStep) => void;
  setIncomeData: (data: Pick<OnboardingInput, 'incomePattern' | 'incomeAmount' | 'sourceCount' | 'incomeIntervalBand'>) => void;
  setHabitsData: (data: Pick<OnboardingInput, 'spendingHabit'>) => void;
  addFixedExpense: (expense: Omit<FixedExpenseItem, 'id'>) => void;
  removeFixedExpense: (id: string) => void;
  updateFixedExpense: (id: string, expense: Partial<FixedExpenseItem>) => void;
  setFixedExpenses: (expenses: FixedExpenseItem[]) => void;
  previewPlan: () => Promise<void>;
  commitPlan: () => Promise<void>;
  reset: () => void;
  /** Re-enters the flow in "retake" mode: same screens, but the final step
   *  calls the retake endpoint (which replaces the active plan) instead of
   *  the initial-onboarding commit endpoint. */
  startRetake: () => void;
  isRetake: boolean;
  goBack: () => void;
  goNext: () => void;
  recoverState: () => Promise<void>;
}

const STEP_ORDER: OnboardingStep[] = ['income', 'habits', 'fixed', 'result'];

const initialInput: Partial<OnboardingInput> = {
  incomePattern: 'salaried',
  spendingHabit: 'tracker',
  incomeAmount: 0,
  fixedTotal: 0,
  sourceCount: 1,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: 'income',
      input: initialInput,
      fixedExpenses: [],
      assignResult: null,
      commitResult: null,
      isLoading: false,
      error: null,
      isRetake: false,

      setStep: (step) => set({ currentStep: step, error: null }),

      setIncomeData: (data) =>
        set((state) => ({
          input: { ...state.input, ...data },
          error: null,
        })),

      setHabitsData: (data) =>
        set((state) => ({
          input: { ...state.input, ...data },
          error: null,
        })),

      addFixedExpense: (expense) =>
        set((state) => {
          const newExpense = { ...expense, id: generateId() };
          const fixedTotal = state.fixedExpenses.reduce((sum: number, e: FixedExpenseItem) => sum + e.amount, 0) + expense.amount;
          return {
            fixedExpenses: [...state.fixedExpenses, newExpense],
            input: { ...state.input, fixedTotal },
            error: null,
          };
        }),

      removeFixedExpense: (id) =>
        set((state) => {
          const fixedTotal = state.fixedExpenses
            .filter((e) => e.id !== id)
            .reduce((sum, e) => sum + e.amount, 0);
          return {
            fixedExpenses: state.fixedExpenses.filter((e) => e.id !== id),
            input: { ...state.input, fixedTotal },
            error: null,
          };
        }),

      updateFixedExpense: (id, updates) =>
        set((state) => {
          const updatedExpenses = state.fixedExpenses.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          );
          const fixedTotal = updatedExpenses.reduce((sum, e) => sum + e.amount, 0);
          return {
            fixedExpenses: updatedExpenses,
            input: { ...state.input, fixedTotal },
            error: null,
          };
        }),

      setFixedExpenses: (expenses) =>
        set((state) => {
          const fixedTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
          return {
            fixedExpenses: expenses,
            input: { ...state.input, fixedTotal },
            error: null,
          };
        }),

      previewPlan: async () => {
        set({ isLoading: true, error: null });
        try {
          const { input } = get();
          const fullInput = input as OnboardingInput;
          
          // Validate required fields
          if (!fullInput.incomeAmount || fullInput.incomeAmount <= 0) {
            throw new Error('Please enter your income amount');
          }
          if (fullInput.fixedTotal >= fullInput.incomeAmount) {
            throw new Error('Fixed expenses cannot exceed income');
          }

          const result = await onboardingApi.assign(fullInput);
          set({ assignResult: result, isLoading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to preview plan', isLoading: false });
          throw error;
        }
      },

      commitPlan: async () => {
        set({ isLoading: true, error: null });
        try {
          const { input, fixedExpenses, isRetake } = get();
          const fullInput = input as OnboardingInput;
          
          // Include fixedExpenses in the commit data
          const commitData = {
            ...fullInput,
            fixedExpenses: fixedExpenses.length > 0 ? fixedExpenses.map(expense => ({
              name: expense.name,
              amount: expense.amount,
              dueDay: expense.dueDay,
              category: expense.category as any, // Cast to satisfy type system
            })) : undefined,
          };
          
          // A retake re-runs the same rules engine against fresh answers
          // and replaces the active plan (see profile.service.ts
          // retakePlan) — it's a distinct endpoint from initial onboarding
          // commit, not just the same call with an empty body.
          const result = isRetake
            ? await profileApi.retakeBehaviorCheckin(commitData)
            : await onboardingApi.commit(commitData);
          set({ commitResult: result, isLoading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to commit plan', isLoading: false });
          throw error;
        }
      },

      reset: () =>
        set({
          currentStep: 'income',
          input: initialInput,
          fixedExpenses: [],
          assignResult: null,
          commitResult: null,
          isLoading: false,
          error: null,
          isRetake: false,
        }),

      startRetake: () =>
        set({
          currentStep: 'income',
          input: initialInput,
          fixedExpenses: [],
          assignResult: null,
          commitResult: null,
          isLoading: false,
          error: null,
          isRetake: true,
        }),

      goBack: () =>
        set((state) => {
          const currentIndex = STEP_ORDER.indexOf(state.currentStep);
          if (currentIndex > 0) {
            return { currentStep: STEP_ORDER[currentIndex - 1], error: null };
          }
          return state;
        }),

      goNext: () =>
        set((state) => {
          const currentIndex = STEP_ORDER.indexOf(state.currentStep);
          if (currentIndex < STEP_ORDER.length - 1) {
            return { currentStep: STEP_ORDER[currentIndex + 1], error: null };
          }
          return state;
        }),

      recoverState: async () => {
        const { assignResult, commitResult, currentStep } = get();
        
        // If user has commitResult but is not on result screen, they may have been interrupted
        if (commitResult && currentStep !== 'result') {
          set({ currentStep: 'result' });
        }
        
        // If user has assignResult but no commitResult, they may have been interrupted during preview
        if (assignResult && !commitResult && currentStep !== 'result') {
          set({ currentStep: 'result' });
        }
      },
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          const data = await storageAdapter.getItem(name);
          return data ? JSON.parse(data) : null;
        },
        setItem: async (name, value) => {
          await storageAdapter.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await storageAdapter.removeItem(name);
        },
      })),
      partialize: (state) => ({
        currentStep: state.currentStep,
        input: state.input,
        fixedExpenses: state.fixedExpenses,
        assignResult: state.assignResult,
        commitResult: state.commitResult,
        isRetake: state.isRetake,
      }),
    }
  )
);