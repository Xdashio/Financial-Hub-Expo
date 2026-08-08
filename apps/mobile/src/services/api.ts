import { supabase } from '@/config/supabase.config';

const API_BASE_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api')
  : 'https://api.financialhub.app/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
};

export const transactionsApi = {
  getByPocketId: (pocketId: string) => api.get<any[]>(`/pockets/${pocketId}/transactions`),
  create: (data: any) => api.post<any>('/transactions', data),
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