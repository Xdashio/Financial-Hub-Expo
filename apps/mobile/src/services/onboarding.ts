import {
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
} from '@financial-hub/shared';

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000' 
  : 'https://api.financialhub.app';

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const onboardingApi = {
  assign: (input: OnboardingInput): Promise<OnboardingAssignResult> =>
    fetchApi<OnboardingAssignResult>('/onboarding/assign', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  commit: (input: OnboardingInput): Promise<OnboardingCommitResult> =>
    fetchApi<OnboardingCommitResult>('/onboarding/commit', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};