import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  pocketsApi, 
  dailyAllocationApi, 
  planningCycleApi, 
  behavioralRecommendationsApi,
  emergencyUnlockApi 
} from '@/services/api';
import { RunwaySummary, DailyAllocation, RunwayImpactOption, DiscretionaryRunway } from '@financial-hub/shared';

// ============================================================================
// Daily Allocation Hooks (Freelancer Runway)
// ============================================================================

export function useTodayDailyAllocation() {
  return useQuery({
    queryKey: ['daily-allocation', 'today'],
    queryFn: () => dailyAllocationApi.getToday(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useDailyAllocationHistory(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['daily-allocation', 'history', startDate, endDate],
    queryFn: () => dailyAllocationApi.getHistory(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}

export function useTriggerDailyAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dailyAllocationApi.trigger(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-allocation'] });
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
    },
  });
}

export function useCloseDailyAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (actualSpend?: number) => dailyAllocationApi.close(actualSpend),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-allocation'] });
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
    },
  });
}

// ============================================================================
// Runway Hooks (with fixed obligations)
// ============================================================================

export function useRunwaySummary() {
  return useQuery({
    queryKey: ['runway'],
    queryFn: () => pocketsApi.getRunway(),
    staleTime: 60 * 1000, // 1 minute
  });
}

// ============================================================================
// Planning Cycle Hooks
// ============================================================================

export function usePlanningCycleStatus() {
  return useQuery({
    queryKey: ['planning-cycle', 'status'],
    queryFn: () => planningCycleApi.getStatus(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePlanningCycleHistory(months = 6) {
  return useQuery({
    queryKey: ['planning-cycle', 'history', months],
    queryFn: () => planningCycleApi.getHistory(months),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurrentPlanningCycle() {
  return useQuery({
    queryKey: ['planning-cycle', 'current'],
    queryFn: () => planningCycleApi.getCurrent(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTriggerPlanningCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => planningCycleApi.trigger(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-cycle'] });
      queryClient.invalidateQueries({ queryKey: ['runway'] });
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
    },
  });
}

export function useApplyPlanningCycleRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, newAllocation }: { expenseId: string; newAllocation: number }) =>
      planningCycleApi.applyRecommendation(expenseId, newAllocation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-cycle'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
    },
  });
}

// ============================================================================
// Behavioral Recommendations Hooks
// ============================================================================

export function useBehavioralRecommendations() {
  return useQuery({
    queryKey: ['behavioral-recommendations'],
    queryFn: () => behavioralRecommendationsApi.getRecommendations(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useBehavioralRecommendationsHistory() {
  return useQuery({
    queryKey: ['behavioral-recommendations', 'history'],
    queryFn: () => behavioralRecommendationsApi.getHistory(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useApplyBehavioralRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, newAllocation }: { expenseId: string; newAllocation: number }) =>
      behavioralRecommendationsApi.applyRecommendation(expenseId, newAllocation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
    },
  });
}

// ============================================================================
// Emergency Unlock Hooks (Runway-Impact Model)
// ============================================================================

export interface EmergencyUnlockEligibility {
  eligible: boolean;
  reason?: string;
  message?: string;
  analysis?: {
    least_daily_spend: number;
    most_daily_spend: number;
    average_daily_spend: number;
    days_of_history: number;
  };
  discretionary_runway?: DiscretionaryRunway;
  runway_impact_options?: RunwayImpactOption[];
  last_used?: string;
  next_available?: string;
}

export function useEmergencyUnlockEligibility() {
  return useQuery({
    queryKey: ['emergency-unlock', 'eligibility'],
    queryFn: () => emergencyUnlockApi.checkEligibility(),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useExecuteEmergencyUnlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; confirm_impact: boolean }) =>
      emergencyUnlockApi.executeUnlock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-unlock'] });
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
      queryClient.invalidateQueries({ queryKey: ['runway'] });
    },
  });
}

// ============================================================================
// Combined hook for Freelancer Dashboard
// ============================================================================

export function useFreelancerDashboard() {
  const runway = useRunwaySummary();
  const dailyAllocation = useTodayDailyAllocation();
  const planningCycle = useCurrentPlanningCycle();
  const recommendations = useBehavioralRecommendations();
  const emergencyEligibility = useEmergencyUnlockEligibility();
  const queryClient = useQueryClient();

  const refetch = async () => {
    await Promise.all([
      runway.refetch(),
      dailyAllocation.refetch(),
      planningCycle.refetch(),
      recommendations.refetch(),
      emergencyEligibility.refetch(),
    ]);
  };

  return {
    runway,
    dailyAllocation,
    planningCycle,
    recommendations,
    emergencyEligibility,
    isLoading: runway.isLoading || dailyAllocation.isLoading || planningCycle.isLoading,
    isError: runway.isError || dailyAllocation.isError || planningCycle.isError,
    refetch,
  };
}