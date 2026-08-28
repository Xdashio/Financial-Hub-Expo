import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
  PlanRetakeResult,
  PlanPreviewResult,
  CategoryPercentages,
  MsmeOnboardingInput,
  BusinessPocketCategory,
} from '@financial-hub/shared';
import { onboardingApi } from '@/services/onboarding';
import { profileApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';

export type OnboardingStep = 'income' | 'habits' | 'about-you' | 'goal' | 'fixed' | 'result';
export type Segment = 'individual' | 'msme';

export interface FixedExpenseItem {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
  icon?: string;
}

/** A user-named spendable business pocket (ADR-001 §5.2), max 6 per MSME plan. */
export interface MsmeCustomPocketItem {
  id: string;
  name: string;
  category: BusinessPocketCategory;
}

export const BUSINESS_CATEGORIES: { id: BusinessPocketCategory; label: string }[] = [
  { id: 'stock', label: 'Stock & Inventory' },
  { id: 'supplier', label: 'Suppliers' },
  { id: 'licence', label: 'Licences' },
  { id: 'tax', label: 'Taxes' },
  { id: 'salary', label: 'Salaries & Wages' },
  { id: 'rent', label: 'Rent' },
  { id: 'operations', label: 'Operations' },
  { id: 'profit', label: 'Profit' },
  { id: 'owner_draw', label: 'Owner Draw' },
  { id: 'growth', label: 'Growth' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'equipment', label: 'Equipment' },
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/** Assembles the MSME onboarding payload (ADR-001 §6.2) from the store's
 *  shared fixedExpenses list plus the business-specific input/pockets. */
function buildMsmeInput(
  msmeInput: Partial<MsmeOnboardingInput>,
  fixedExpenses: FixedExpenseItem[],
  msmeCustomPockets: MsmeCustomPocketItem[],
): MsmeOnboardingInput {
  return {
    segment: 'msme',
    businessName: (msmeInput.businessName ?? '').trim(),
    monthlyRevenue: msmeInput.monthlyRevenue ?? 0,
    hasEmployees: msmeInput.hasEmployees ?? false,
    businessStage: msmeInput.businessStage,
    savingsGoal: msmeInput.savingsGoal,
    fixedTotal: fixedExpenses.reduce((sum, e) => sum + e.amount, 0),
    fixedExpenses: fixedExpenses.length > 0
      ? fixedExpenses.map((e) => ({ name: e.name, amount: e.amount, dueDay: e.dueDay, category: e.category as any }))
      : undefined,
    customPockets: msmeCustomPockets.map((p) => ({ name: p.name, category: p.category })),
  };
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
  commitResult: OnboardingCommitResult | PlanRetakeResult | null;
  /** Per-category spendable breakdown + percentages powering the result
   *  screen's percentage editor (audit_team.md item 3). Loaded on demand,
   *  separate from assignResult so the initial "assign" call (made right
   *  after the fixed-expenses step) doesn't need to know about categories. */
  planPreview: PlanPreviewResult | null;
  isPreviewLoading: boolean;
  isLoading: boolean;
  error: string | null;

  // MSME segment (ADR-001 §5.1): Business onboarding runs on its own input
  // shape (businessName + monthlyRevenue + up to 6 business-category
  // pockets) but shares the store's fixedExpenses list and assignResult.
  segment: Segment;
  msmeInput: Partial<MsmeOnboardingInput>;
  msmeCustomPockets: MsmeCustomPocketItem[];

  // Actions
  setStep: (step: OnboardingStep) => void;
  setIncomeData: (data: Pick<OnboardingInput, 'incomePattern' | 'incomeAmount' | 'sourceCount' | 'incomeIntervalBand'>) => void;
  setHabitsData: (data: Pick<OnboardingInput, 'spendingHabit'>) => void;
  setAboutYouData: (
    data: Pick<
      OnboardingInput,
      'lifeStage' | 'hasDependents' | 'emergencyBuffer' | 'moneyPersonality' | 'hasTransportNeed'
    >,
  ) => void;
  /** Sets or clears the captured savings goal (Part 4). Pass `undefined` to
   *  skip the goal step — the rules engine falls back to the buffer-based
   *  rate with no goal-shortfall messaging. */
  setSavingsGoalData: (goal: OnboardingInput['savingsGoal']) => void;
  addFixedExpense: (expense: Omit<FixedExpenseItem, 'id'>) => void;
  removeFixedExpense: (id: string) => void;
  updateFixedExpense: (id: string, expense: Partial<FixedExpenseItem>) => void;
  setFixedExpenses: (expenses: FixedExpenseItem[]) => void;
  previewPlan: () => Promise<void>;
  /** Loads (or reloads) the category breakdown for the result screen. Call
   *  with no argument to seed with defaults, or with an edited percentage
   *  map to re-price a user's slider changes before they commit. Throws
   *  (and leaves `input.categoryPercentages` unchanged) if the edited split
   *  fails server-side validation, so a bad edit never corrupts state. */
  loadPlanPreview: (percentages?: CategoryPercentages) => Promise<void>;
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

  // MSME actions
  setSegment: (segment: Segment) => void;
  setMsmeData: (data: Partial<MsmeOnboardingInput>) => void;
  addCustomPocket: (pocket: { name: string; category: BusinessPocketCategory }) => void;
  removeCustomPocket: (id: string) => void;
  previewMsmePlan: () => Promise<void>;
  commitMsmePlan: () => Promise<void>;
}

const STEP_ORDER: OnboardingStep[] = ['income', 'habits', 'about-you', 'goal', 'fixed', 'result'];

const initialInput: Partial<OnboardingInput> = {
  incomePattern: 'salaried',
  spendingHabit: 'tracker',
  incomeAmount: 0,
  fixedTotal: 0,
  sourceCount: 1,
  lifeStage: 'working_adult',
  hasDependents: false,
  emergencyBuffer: 'under_month',
  moneyPersonality: 'saver',
  // Default true = today's even-weighted transport share. Only an explicit
  // `false` (remote worker, no regular transport spend) folds transport
  // into a smaller share — see hasTransportNeed's doc comment in the shared
  // schema.
  hasTransportNeed: true,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: 'income',
      input: initialInput,
      fixedExpenses: [],
      assignResult: null,
      commitResult: null,
      planPreview: null,
      isPreviewLoading: false,
      isLoading: false,
      error: null,
      isRetake: false,
      segment: 'individual',
      msmeInput: {},
      msmeCustomPockets: [],

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

      setAboutYouData: (data) =>
        set((state) => ({
          input: { ...state.input, ...data },
          error: null,
        })),

      setSavingsGoalData: (goal) =>
        set((state) => ({
          input: { ...state.input, savingsGoal: goal },
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

      loadPlanPreview: async (percentages) => {
        set({ isPreviewLoading: true, error: null });
        try {
          const { input, fixedExpenses } = get();
          const fullInput = {
            ...(input as OnboardingInput),
            fixedExpenses: fixedExpenses.length > 0 ? fixedExpenses.map((expense) => ({
              name: expense.name,
              amount: expense.amount,
              dueDay: expense.dueDay,
              category: expense.category as any,
            })) : undefined,
            ...(percentages ? { categoryPercentages: percentages } : {}),
          };

          const preview = await onboardingApi.planPreview(fullInput);

          // Only persist the edited percentages into `input` once the server
          // has confirmed they're valid — an invalid edit throws above and
          // leaves the last-known-good percentages (and pockets) in place.
          set((state) => ({
            planPreview: preview,
            input: percentages ? { ...state.input, categoryPercentages: percentages } : state.input,
            isPreviewLoading: false,
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to preview category split', isPreviewLoading: false });
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
          if (isRetake) {
            useDataSync.getState().bump();
          }
          set({ commitResult: result, isLoading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to commit plan', isLoading: false });
          throw error;
        }
      },

      setSegment: (segment) => set({ segment, error: null }),

      setMsmeData: (data) =>
        set((state) => ({
          msmeInput: { ...state.msmeInput, ...data },
          error: null,
        })),

      addCustomPocket: (pocket) =>
        set((state) => {
          if (state.msmeCustomPockets.length >= 6) {
            return { error: 'You can have up to 6 business pockets.' };
          }
          return {
            msmeCustomPockets: [...state.msmeCustomPockets, { ...pocket, id: generateId() }],
            error: null,
          };
        }),

      removeCustomPocket: (id) =>
        set((state) => ({
          msmeCustomPockets: state.msmeCustomPockets.filter((p) => p.id !== id),
          error: null,
        })),

      previewMsmePlan: async () => {
        set({ isLoading: true, error: null });
        try {
          const { msmeInput, fixedExpenses, msmeCustomPockets } = get();
          const fullInput = buildMsmeInput(msmeInput, fixedExpenses, msmeCustomPockets);
          const result = await onboardingApi.msmeAssign(fullInput);
          set({ assignResult: result, isLoading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to preview plan', isLoading: false });
          throw error;
        }
      },

      commitMsmePlan: async () => {
        set({ isLoading: true, error: null });
        try {
          const { msmeInput, fixedExpenses, msmeCustomPockets } = get();
          const fullInput = buildMsmeInput(msmeInput, fixedExpenses, msmeCustomPockets);
          const result = await onboardingApi.msmeCommit(fullInput);
          useDataSync.getState().bump();
          set({ commitResult: result, isLoading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to create your business plan', isLoading: false });
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
          planPreview: null,
          isPreviewLoading: false,
          isLoading: false,
          error: null,
          isRetake: false,
          segment: 'individual',
          msmeInput: {},
          msmeCustomPockets: [],
        }),

      startRetake: () =>
        set({
          currentStep: 'income',
          input: initialInput,
          fixedExpenses: [],
          assignResult: null,
          commitResult: null,
          planPreview: null,
          isPreviewLoading: false,
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
        segment: state.segment,
        msmeInput: state.msmeInput,
        msmeCustomPockets: state.msmeCustomPockets,
      }),
    }
  )
);