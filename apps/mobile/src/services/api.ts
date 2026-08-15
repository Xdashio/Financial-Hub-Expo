import { supabase } from '@/config/supabase.config';
import { API_BASE_URL } from '@/config/api';

// Set EXPO_PUBLIC_API_URL in .env.local (dev) or eas.json (EAS builds).

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Bypass ngrok's browser interstitial page in dev (safe no-op in production)
    'ngrok-skip-browser-warning': 'true',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

/** Client idempotency key for money-moving writes (income / spend). */
export function createIdempotencyKey(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    const raw = error.message ?? error.error ?? `HTTP ${response.status}`;
    const message = Array.isArray(raw) ? raw.join(', ') : String(raw);
    throw new Error(message || `HTTP ${response.status}`);
  }

  // DELETE /profile/fixed-expenses/:id returns 204 No Content. Calling
  // response.json() on an empty body throws and made delete look broken
  // (optimistic remove rolled back even when the server deleted the row).
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: unknown) => fetchApi<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  put: <T>(endpoint: string, body: unknown) => fetchApi<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  patch: <T>(endpoint: string, body: unknown) => fetchApi<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),
  delete: <T>(endpoint: string) => fetchApi<T>(endpoint, { method: 'DELETE' }),
};

import {
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
  RunwaySummary,
} from '@financial-hub/shared';

export const onboardingApi = {
  assign: (input: OnboardingInput): Promise<OnboardingAssignResult> =>
    api.post<OnboardingAssignResult>('/onboarding/assign', input),

  commit: (input: OnboardingInput): Promise<OnboardingCommitResult> =>
    api.post<OnboardingCommitResult>('/onboarding/commit', input),
};

export const pocketsApi = {
  getAll: () => api.get<any[]>('/pockets'),
  // { applicable: false } for salaried/mix/structured plans. See
  // docs/FREELANCER_RUNWAY.md.
  getRunway: () => api.get<RunwaySummary>('/pockets/runway'),
  getById: (id: string) => api.get<any>(`/pockets/${id}`),
  update: (id: string, data: unknown) => api.put<any>(`/pockets/${id}`, data),
  create: (data: { name: string; kind?: string; category?: string; monthlyAllocation?: number; dailyCap?: number }) =>
    api.post<any>('/pockets', data),
  delete: (id: string) => api.delete<any>(`/pockets/${id}`),
  getSummary: (id: string) => api.get<any>(`/pockets/${id}/summary`),
  getTransactions: (id: string, page = 1, limit = 20) =>
    api.get<any>(`/pockets/${id}/transactions?page=${page}&limit=${limit}`),
  getMerchantScope: (id: string) => api.get<any>(`/pockets/${id}/merchant-scope`),
  getLockStatus: (id: string) => api.get<any>(`/pockets/${id}/lock-status`),
  unlock: (id: string, data: { reason?: string; biometric_confirmed: boolean }) =>
    api.post<any>(`/pockets/${id}/unlock`, data),
  extendLock: (id: string, data: { additional_days: number; reason?: string }) =>
    api.post<any>(`/pockets/${id}/extend-lock`, data),
  // Sub-pockets (audit_team.md item 10) — nested one level under a parent
  // pocket, e.g. splitting a Loans pocket into "Repayment" + purpose
  // sub-pockets.
  getSubPockets: (parentId: string) => api.get<any[]>(`/pockets/${parentId}/sub-pockets`),
  // splitPercentage is the share of the parent's monthly_allocation this
  // sub-pocket earmarks (0–100). The API derives the cached KSh amount
  // (monthly_allocation = parent.monthly_allocation * splitPercentage / 100).
  createSubPocket: (parentId: string, data: { name: string; splitPercentage: number; category?: string }) =>
    api.post<any>(`/pockets/${parentId}/sub-pockets`, data),
  deleteSubPocket: (id: string) => api.delete<any>(`/pockets/${id}/sub-pocket`),
  // PATCH /pockets/:id/rebalance — bulk-adjusts the full sibling set's
  // splitPercentage in one call (the rebalance bottom-sheet). :id is any
  // pocket in the family (parent or sibling); the service resolves the
  // shared parent. confirmPartial opts into the partial-now-catch-up-later
  // path when the move needs more money than is currently available.
  rebalanceSubPockets: (
    anchorId: string,
    splits: Array<{ pocketId: string; splitPercentage: number }>,
    confirmPartial = false,
  ) => api.patch<any>(`/pockets/${anchorId}/rebalance`, { splits, confirmPartial }),
  // Returns { total_allocated, plan_income, unallocated, over_allocated }
  // so pocket-create can show % of income feedback without a second fetch.
  getAllocationSummary: () => api.get<any>('/pockets/allocation-summary'),
};

export const loansApi = {
  getAll: () => api.get<any[]>('/loans'),
  getById: (id: string) => api.get<any>(`/loans/${id}`),
  create: (data: {
    name: string;
    totalAmount: number;
    repaymentAmount: number;
    cadence: 'weekly' | 'biweekly' | 'monthly';
    startDate: string;
    endDate: string;
    dueDay: number;
    loanProvider?: string;
    loanPurpose?: string;
  }) => api.post<any>('/loans', data),
  update: (id: string, data: any) => api.put<any>(`/loans/${id}`, data),
  createPurposeSubPocket: (id: string, data: { name: string; category: string; monthlyAllocation: number }) =>
    api.post<any>(`/loans/${id}/purpose-sub-pockets`, data),
  fundRepayment: (id: string, amount: number) =>
    api.post<any>(`/loans/${id}/fund-repayment`, { amount }),
};

export const spendApi = {
  check: (data: { 
    pocket_id: string; 
    amount: number; 
    recipient_key?: string; 
    category?: string;
    override?: boolean;
    borrow_from_parent?: boolean;
  }) =>
    api.post<any>('/spend/check', data),
  commit: (data: {
    pocket_id: string;
    amount: number;
    recipient_key?: string;
    category?: string;
    idempotency_key?: string;
    override?: boolean;
    borrow_from_parent?: boolean;
  }) =>
    api.post<any>('/spend/commit', {
      ...data,
      idempotency_key: data.idempotency_key || createIdempotencyKey('spend'),
    }),
  getBlockedReasons: (pocketId: string) =>
    api.get<any>(`/spend/blocked-reasons?pocket_id=${encodeURIComponent(pocketId)}`),
};

export const reallocationsApi = {
  getAll: () => api.get<any[]>('/reallocations'),
  create: (data: any) => api.post<any>('/reallocations', data),
  complete: (id: string, data: { skipCoolingOff?: boolean } = {}) =>
    api.post<any>(`/reallocations/${id}/complete`, data),
};

export const insightsApi = {
  getDisciplineScore: () => api.get<any>('/insights/discipline-score'),
  getStreak: () =>
    api.get<{
      currentStreak: number;
      longestStreak: number;
      nextMilestone: number | null;
      hitMilestone: number | null;
      freezesRemaining: number;
      todayCounted: boolean;
    }>('/insights/streak'),
  getBehaviorEvents: () => api.get<any[]>('/insights/behavior-events'),
  getBehaviorEventsPaginated: (page = 1, limit = 20) =>
    api.get<any>(`/insights/behavior-events/paginated?page=${page}&limit=${limit}`),
  getActivityHeatmap: (range: 'week' | 'month' | 'year' = 'month') =>
    api.get<Array<{ date: string; count: number; points: number }>>(
      `/insights/activity-heatmap?range=${range}`
    ),
  getActivityHeatmapDay: (date: string) =>
    api.get<any[]>(`/insights/activity-heatmap/day?date=${date}`),
};

export const rolloverApi = {
  run: () =>
    api.post<{
      days: Array<{ date: string; skipped: boolean; amount: number }>;
      totalAmount: number;
      latestAmount: number;
      streak: {
        currentStreak: number;
        longestStreak: number;
        nextMilestone: number | null;
        hitMilestone: number | null;
        freezesRemaining: number;
        todayCounted: boolean;
      };
      milestoneAwarded: number | null;
    }>('/income/rollover/run', {}),
  status: () =>
    api.get<{
      streak: {
        currentStreak: number;
        longestStreak: number;
        nextMilestone: number | null;
        hitMilestone: number | null;
        freezesRemaining: number;
        todayCounted: boolean;
      };
      monthToDateAmount: number;
    }>('/income/rollover/status'),
};

export const profileApi = {
  getFixedExpenses: () => api.get<any[]>('/profile/fixed-expenses'),
  getPlan: () => api.get<any>('/profile/plan'),
  getRetakeEligibility: () =>
    api.get<{
      allowed: boolean;
      nextRetakeAvailableOn: string | null;
      lastRetakenAt: string | null;
      message?: string;
    }>('/profile/plan/retake-eligibility'),
  retakeBehaviorCheckin: (data: any) =>
    api.post<{
      planId: string;
      pockets: any[];
      redistribution: {
        totalMoved: number;
        movements: Array<{
          fromPocketName: string;
          toPocketName: string;
          amount: number;
          reason: string;
        }>;
        previousPlanType: string;
        newPlanType: string;
        nextRetakeAvailableOn: string;
      };
    }>('/profile/plan/retake', data),
  commitPlanPercentages: (data: any) => api.post<any>('/profile/plan/percentages/commit', data),
  editPlanPercentages: (data: any) => api.patch<any>('/profile/plan/percentages', data),
};

export interface NotificationPreferences {
  reallocation_confirms: boolean;
  cooling_off_reminders: boolean;
  savings_milestones: boolean;
  monthly_insights: boolean;
  tips_nudges: boolean;
  loan_reminders: boolean;
}

export const notificationsApi = {
  getSettings: () =>
    api.get<{ preferences: NotificationPreferences; user_id: string; updated_at: string | null; is_default?: boolean }>(
      '/notifications/settings'
    ),
  updateSettings: (data: Partial<NotificationPreferences>) =>
    api.put<{ preferences: NotificationPreferences; user_id: string; updated_at: string }>(
      '/notifications/settings',
      data
    ),
  registerPushToken: (data: {
    token: string;
    platform: 'ios' | 'android' | 'web';
    device_id?: string;
  }) => api.post<{ token: string; platform: string }>('/notifications/push-token', data),
  unregisterPushToken: (token: string) =>
    api.delete<{ removed: boolean }>(
      `/notifications/push-token?token=${encodeURIComponent(token)}`
    ),
};

export const merchantReportApi = {
  createReport: (data: {
    recipient_key: string;
    report_type: 'wrong_category' | 'not_gambling' | 'wrong_amount' | 'unknown_payee';
    description?: string;
    transaction_id?: string;
    suggested_category?: string;
  }) => api.post<any>('/merchant/report', data),
  getReports: (page = 1, limit = 20, status?: string) =>
    api.get<any>(
      `/merchant/reports?page=${page}&limit=${limit}${status ? `&status=${encodeURIComponent(status)}` : ''}`
    ),
};

export const emergencyUnlockApi = {
  checkEligibility: () =>
    api.get<{
      eligible: boolean;
      reason?: string;
      message?: string;
      analysis?: {
        least_daily_spend: number;
        most_daily_spend: number;
        average_daily_spend: number;
        days_of_history: number;
      };
      savings_reserve?: {
        total_savings: number;
        minimum_reserve: number;
        available_to_unlock: number;
      };
      days_of_history?: number;
      minimum_required_days?: number;
      last_used?: string;
      next_available?: string;
    }>('/pockets/emergency-unlock/eligibility'),
  executeUnlock: (data: { amount: number; confirm_reserve: boolean }) =>
    api.post<{
      applied: boolean;
      unlock?: {
        id: string;
        amount: number;
        days_lasting: number;
        reserve_kept: number;
        allocations: Array<{
          pocket_id: string;
          pocket_name: string;
          amount: number;
          percentage: number;
        }>;
      };
      error?: string;
      message?: string;
      next_available?: string;
    }>('/pockets/emergency-unlock', data),
};

export const incomeApi = {
  allocatePreview: (data: { amount: number; source: 'client_payment' | 'cash' | 'other' }) =>
    api.post<any>('/income/manual/allocate-preview', data),
  createManual: (data: {
    amount: number;
    source: 'client_payment' | 'cash' | 'other';
    label?: string;
    date: string;
    run_allocation: boolean;
    idempotency_key?: string;
  }) =>
    api.post<any>('/income/manual', {
      ...data,
      idempotency_key: data.idempotency_key || createIdempotencyKey('income'),
    }),
  allocateSurplus: (incomeEventId: string, data: {
    target: 'main_pocket' | 'pocket' | 'new_pocket';
    pocket_id?: string;
    new_pocket_name?: string;
  }) =>
    api.post<any>(`/income/${incomeEventId}/allocate-surplus`, data),
};

export const merchantApi = {
  classify: (data: {
    recipient_key: string;
    category: string;
    pocket_id: string;
    remember: boolean;
    transaction_id?: string;
    amount?: number;
    description?: string;
  }) => api.post<any>('/merchant/classify', data),
  getClassifications: (page = 1, limit = 50, search?: string) =>
    api.get<any>(
      `/merchant/classifications?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`
    ),
  deleteClassification: (id: string) => api.delete<void>(`/merchant/classifications/${id}`),
};