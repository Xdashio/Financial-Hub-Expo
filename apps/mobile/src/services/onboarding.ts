import {
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
} from '@financial-hub/shared';
import { supabase } from '@/config/supabase.config';

const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://api.financialhub.app/api';

async function fetchWithAuth<T>(endpoint: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const onboardingApi = {
  assign: (input: OnboardingInput): Promise<OnboardingAssignResult> =>
    fetchWithAuth<OnboardingAssignResult>('/onboarding/assign', input),

  commit: (input: OnboardingInput): Promise<OnboardingCommitResult> =>
    fetchWithAuth<OnboardingCommitResult>('/onboarding/commit', input),
};