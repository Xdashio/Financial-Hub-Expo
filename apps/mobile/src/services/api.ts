import { supabase } from '@/config/supabase.config';

// In dev, set EXPO_PUBLIC_API_URL in .env.local to your ngrok URL.
// Both web and native use the same URL — ngrok works for all platforms.
// e.g.
const API_BASE_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api')
  : 'https://api.financialhub.app/api';

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
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: any) => fetchApi<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  put: <T>(endpoint: string, body: any) => fetchApi<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  delete: <T>(endpoint: string) => fetchApi<T>(endpoint, { method: 'DELETE' }),
};

import {
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
} from '@financial-hub/shared';

export const onboardingApi = {
  assign: (input: OnboardingInput): Promise<OnboardingAssignResult> =>
    api.post<OnboardingAssignResult>('/onboarding/assign', input),

  commit: (input: OnboardingInput): Promise<OnboardingCommitResult> =>
    api.post<OnboardingCommitResult>('/onboarding/commit', input),
};

export const pocketsApi = {
  getAll: () => api.get<any[]>('/pockets'),
  getById: (id: string) => api.get<any>(`/pockets/${id}`),
  update: (id: string, data: any) => api.put<any>(`/pockets/${id}`, data),
  getSummary: (id: string) => api.get<any>(`/pockets/${id}/summary`),
  getTransactions: (id: string, page = 1, limit = 20) =>
    api.get<any>(`/pockets/${id}/transactions?page=${page}&limit=${limit}`),
  getMerchantScope: (id: string) => api.get<any>(`/pockets/${id}/merchant-scope`),
  getLockStatus: (id: string) => api.get<any>(`/pockets/${id}/lock-status`),
  unlock: (id: string, data: { reason?: string; biometric_confirmed: boolean }) =>
    api.post<any>(`/pockets/${id}/unlock`, data),
  extendLock: (id: string, data: { additional_days: number; reason?: string }) =>
    api.post<any>(`/pockets/${id}/extend-lock`, data),
};

export const transactionsApi = {
  getByPocketId: (pocketId: string) => api.get<any[]>(`/pockets/${pocketId}/transactions`),
};

export const spendApi = {
  check: (data: { pocket_id: string; amount: number; recipient_key?: string; category?: string }) =>
    api.post<any>('/spend/check', data),
  commit: (data: { pocket_id: string; amount: number; recipient_key?: string; category?: string }) =>
    api.post<any>('/spend/commit', data),
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
  getBehaviorEvents: () => api.get<any[]>('/insights/behavior-events'),
};

export const profileApi = {
  getFixedExpenses: () => api.get<any[]>('/profile/fixed-expenses'),
  createFixedExpense: (data: any) => api.post<any>('/profile/fixed-expenses', data),
  updateFixedExpense: (id: string, data: any) => api.put<any>(`/profile/fixed-expenses/${id}`, data),
  deleteFixedExpense: (id: string) => api.delete<void>(`/profile/fixed-expenses/${id}`),
  getPlan: () => api.get<any>('/profile/plan'),
  retakeBehaviorCheckin: () => api.post<any>('/profile/plan/retake', {}),
};

export interface NotificationPreferences {
  reallocation_confirms: boolean;
  cooling_off_reminders: boolean;
  savings_milestones: boolean;
  monthly_insights: boolean;
  tips_nudges: boolean;
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

export const incomeApi = {
  allocatePreview: (data: { amount: number; source: 'client_payment' | 'cash' | 'other' }) =>
    api.post<any>('/income/manual/allocate-preview', data),
  createManual: (data: {
    amount: number;
    source: 'client_payment' | 'cash' | 'other';
    label?: string;
    date: string;
    run_allocation: boolean;
  }) => api.post<any>('/income/manual', data),
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