import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, Text, Pressable } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography } from '@/theme';
import { formatMoney } from '@/utils/money';
import { RunwayVisualization } from '@/components/pockets/RunwayVisualization';
import { DailyAllocationToday } from '@/components/pockets/DailyAllocationToday';
import { EmergencyUnlockRunwayImpactSheet } from '@/components/pockets/EmergencyUnlockRunwayImpactSheet';
import { 
  useFreelancerDashboard, 
  useExecuteEmergencyUnlock,
  usePlanningCycleStatus,
  useCurrentPlanningCycle,
  usePlanningCycleHistory,
} from '@/hooks/useFreelancer';
import { Button } from '@/components/ui/Button';
import { PocketGlyph } from '@/components/ui/PocketGlyph';
import { PocketLoader } from '@/components/ui/PocketLoader';
import { AlertTriangle, Zap, Target, Shield } from 'lucide-react-native';

export function FreelancerDashboard() {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [showEmergencyUnlock, setShowEmergencyUnlock] = useState(false);
  
  const { 
    runway, 
    dailyAllocation, 
    planningCycle, 
    recommendations, 
    emergencyEligibility,
    isLoading,
    isError,
    refetch 
  } = useFreelancerDashboard();

  const { data: planningCycleStatus } = usePlanningCycleStatus();
  const { data: currentPlanningCycle } = useCurrentPlanningCycle();
  const { data: planningCycleHistory } = usePlanningCycleHistory(6);

  const executeEmergencyUnlock = useExecuteEmergencyUnlock();

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleEmergencyUnlock = async (amount: number) => {
    try {
      await executeEmergencyUnlock.mutateAsync({ 
        amount, 
        confirm_impact: true 
      });
      setShowEmergencyUnlock(false);
    } catch (error) {
      console.error('Emergency unlock failed:', error);
    }
  };

  // Loading state
  if (isLoading && !runway.data) {
    return (
      <View style={styles.loadingContainer}>
        <PocketLoader size={48} color={colors.emeraldDeep} />
        <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.md }}>
          Loading your freelancer dashboard…
        </Text>
      </View>
    );
  }

  // Error state
  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <PocketGlyph kind="emergency" size={32} color={colors.clay} />
        <Text style={{ ...typography.heading, color: colors.ink, marginTop: spacing.md, textAlign: 'center' }}>
          Failed to load dashboard
        </Text>
        <Text style={{ ...typography.body, color: colors.sage, textAlign: 'center', marginTop: spacing.xs }}>
          Pull to refresh or try again later
        </Text>
        <Button variant="primary" onPress={onRefresh} style={{ marginTop: spacing.lg, width: 200 }}>
          Try Again
        </Button>
      </View>
    );
  }

  const runwayData = runway.data;
  const allocationData = dailyAllocation.data;
  const emergencyData = emergencyEligibility.data;

  const applicable = runwayData?.applicable === true;
  const runwayDays = applicable ? (runwayData?.runwayDays ?? 0) : 0;
  const discretionaryReserve = applicable ? (runwayData?.discretionaryReserve ?? 0) : 0;
  const dailyBudget = applicable ? (runwayData?.dailyBudget ?? 0) : 0;
  const fixedObligations = applicable ? (runwayData?.fixedObligations ?? 0) : 0;

  const allocation = allocationData?.allocation ?? null;
  const spendablePockets = allocationData?.spendablePockets ?? [];

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#10B981']}
        />
      }
      showsVerticalScrollIndicator={false}
      style={styles.container}
    >
      {/* Hero: Runway Visualization */}
      <View style={styles.heroSection}>
        <RunwayVisualization 
          runway={runwayData} 
          showDetails={true}
        />
      </View>

      {/* Today's Allocation */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.heading, { color: colors.ink }]}>Today's Allocation</Text>
          <View style={styles.headerActions}>
            {allocation && (
              <View style={styles.miniStats}>
                <View style={styles.miniStat}>
                  <Text style={[typography.caption, { color: colors.sage }]}>Spent</Text>
                  <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                    {formatMoney(allocation.actual_spend ?? 0)}
                  </Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={[typography.caption, { color: colors.sage }]}>Remaining</Text>
                  <Text style={[typography.body, { color: colors.emeraldDeep, fontVariant: ['tabular-nums'] }]}>
                    {formatMoney(Math.max(0, (allocation.planned_amount ?? 0) - (allocation.actual_spend ?? 0)))}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <DailyAllocationToday
          allocation={allocation}
          runway={runwayData}
          spendablePockets={spendablePockets}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[typography.heading, { color: colors.ink, marginBottom: spacing.md }]}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <Pressable style={styles.quickActionCard} onPress={() => setShowEmergencyUnlock(true)}>
            <View style={styles.quickActionIcon}>
              <Zap size={24} color={colors.emeraldDeep} strokeWidth={2} />
            </View>
            <Text style={[typography.body, { color: colors.ink }]}>Emergency Allocation</Text>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
              {emergencyData?.eligible ? 'Available' : 'Not available'}
            </Text>
          </Pressable>
          
          <Pressable style={styles.quickActionCard}>
            <View style={styles.quickActionIcon}>
              <Target size={24} color={colors.gold} strokeWidth={2} />
            </View>
            <Text style={[typography.body, { color: colors.ink }]}>Planning Cycle</Text>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
              {planningCycleStatus?.days_until_next > 0 
                ? `In ${planningCycleStatus.days_until_next} days` 
                : 'Due today'}
            </Text>
          </Pressable>
          
          <Pressable style={styles.quickActionCard}>
            <View style={styles.quickActionIcon}>
              <Shield size={24} color={colors.emeraldDeep} strokeWidth={2} />
            </View>
            <Text style={[typography.body, { color: colors.ink }]}>Behavioral Insights</Text>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
              {recommendations.data?.length > 0 
                ? `${recommendations.data.length} recommendation${recommendations.data.length !== 1 ? 's' : ''}` 
                : 'Building history'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Behavioral Recommendations Preview */}
      {recommendations.data && recommendations.data.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[typography.heading, { color: colors.ink }]}>Smart Recommendations</Text>
          </View>
          <View style={styles.recommendationsPreview}>
            {recommendations.data.slice(0, 2).map((rec) => {
              const confidenceColor = 
                rec.confidence === 'high' ? colors.emeraldDeep :
                rec.confidence === 'medium' ? colors.gold : colors.clay;
              const recText = rec.currentAllocation !== rec.recommendedAllocation
                ? `${rec.currentAllocation > rec.recommendedAllocation ? 'Reduce' : 'Increase'} from ${formatMoney(rec.currentAllocation)} to ${formatMoney(rec.recommendedAllocation)}`
                : 'Allocation is optimal';
              return (
                <Pressable key={rec.expenseId} style={styles.recPreviewCard}>
                  <View style={styles.recPreviewContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 }}>
                      <Text style={[typography.caption, { color: colors.ink, fontWeight: '600' }]}>{rec.name}</Text>
                      <View style={[
                        styles.confidenceDot,
                        { backgroundColor: confidenceColor }
                      ]} />
                    </View>
                    <Text style={{ ...typography.caption, color: colors.sage }}>
                      {recText}
                    </Text>
                  </View>
                  <AlertTriangle size={16} color={colors.sage} strokeWidth={1.5} />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Planning Cycle Status */}
      {planningCycleStatus && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[typography.heading, { color: colors.ink }]}>Planning Cycle</Text>
          </View>
          <View style={styles.planningCycleCard}>
            <View style={styles.planningCycleRow}>
              <View style={styles.planningCycleStat}>
                <Text style={[typography.caption, { color: colors.sage }]}>Next Run</Text>
                <Text style={[typography.body, { color: colors.ink, fontWeight: '600' }]}>
                  {planningCycleStatus.next_planning_date 
                    ? new Date(planningCycleStatus.next_planning_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })
                    : '—'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.planningCycleStat}>
                <Text style={[typography.caption, { color: colors.sage }]}>In</Text>
                <Text style={[typography.body, { color: colors.ink, fontWeight: '600' }]}>
                  {planningCycleStatus.days_until_next > 0 
                    ? `${planningCycleStatus.days_until_next} day${planningCycleStatus.days_until_next !== 1 ? 's' : ''}`
                    : 'Today'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.planningCycleStat}>
                <Text style={[typography.caption, { color: colors.sage }]}>Last Run</Text>
                <Text style={[typography.body, { color: colors.ink, fontWeight: '600' }]}>
                  {planningCycleStatus.last_planning_cycle_at
                    ? new Date(planningCycleStatus.last_planning_cycle_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })
                    : 'Never'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Emergency Unlock Sheet */}
      <EmergencyUnlockRunwayImpactSheet
        visible={showEmergencyUnlock}
        onClose={() => setShowEmergencyUnlock(false)}
        onUnlock={handleEmergencyUnlock}
        isLoading={executeEmergencyUnlock.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  heroSection: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  miniStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  miniStat: {
    alignItems: 'flex-end',
  },
  headerActions: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickActionCard: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationsPreview: {
    gap: spacing.md,
  },
  recPreviewCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  recPreviewContent: {
    flex: 1,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planningCycleCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  planningCycleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planningCycleStat: {
    alignItems: 'center',
    flex: 1,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: colors.lineSoft,
  },
});

const { colors } = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
  },
});

export default FreelancerDashboard;