import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
} from '@financial-hub/shared';
import { onboardingApi } from '@/services/onboarding';

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
  setIncomeData: (data: Pick<OnboardingInput, 'incomePattern' | 'incomeAmount' | 'sourceCount'>) => void;
  setHabitsData: (data: Pick<OnboardingInput, 'spendingHabit'>) => void;
  addFixedExpense: (expense: Omit<FixedExpenseItem, 'id'>) => void;
  removeFixedExpense: (id: string) => void;
  updateFixedExpense: (id: string, expense: Partial<FixedExpenseItem>) => void;
  setFixedExpenses: (expenses: FixedExpenseItem[]) => void;
  previewPlan: () => Promise<void>;
  commitPlan: () => Promise<void>;
  reset: () => void;
  goBack: () => void;
  goNext: () => void;
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
          set({ assignResult: result, isLoading: false, currentStep: 'result' });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to preview plan', isLoading: false });
          throw error;
        }
      },

      commitPlan: async () => {
        set({ isLoading: true, error: null });
        try {
          const { input } = get();
          const fullInput = input as OnboardingInput;
          
          const result = await onboardingApi.commit(fullInput);
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
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          if (name === 'onboarding-storage') {
            const data = await SecureStore.getItemAsync(name);
            return data ? JSON.parse(data) : null;
          }
          return null;
        },
        setItem: async (name, value) => {
          if (name === 'onboarding-storage') {
            await SecureStore.setItemAsync(name, JSON.stringify(value));
          }
        },
        removeItem: async (name) => {
          if (name === 'onboarding-storage') {
            await SecureStore.deleteItemAsync(name);
          }
        },
      })),
      partialize: (state) => ({
        currentStep: state.currentStep,
        input: state.input,
        fixedExpenses: state.fixedExpenses,
        assignResult: state.assignResult,
      }),
    }
  )
);

// Import SecureStore for persistence
import * as SecureStore from 'expo-secure-store';