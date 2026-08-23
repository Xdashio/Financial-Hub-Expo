import {
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
  PlanPreviewResult,
} from '@financial-hub/shared';
import { supabase } from '@/config/supabase.config';
import { API_BASE_URL } from '@/config/api';

async function fetchWithAuth<T>(endpoint: string, body: unknown, method: 'POST' | 'PATCH' = 'POST'): Promise<T> {
  // Try to get session, but don't fail if it's not available during onboarding
  let session = null;
  try {
    const result = await supabase.auth.getSession();
    session = result.data.session;
  } catch {
    console.log('No session available, proceeding without auth');
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
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

  /** Pre-commit preview with an editable per-category spendable breakdown.
   *  Pass `input.categoryPercentages` to re-validate and re-price a
   *  user-edited split before committing. */
  planPreview: (input: OnboardingInput): Promise<PlanPreviewResult> =>
    fetchWithAuth<PlanPreviewResult>('/onboarding/plan-preview', input, 'PATCH'),

  commit: (input: OnboardingInput): Promise<OnboardingCommitResult> =>
    fetchWithAuth<OnboardingCommitResult>('/onboarding/commit', input),
};