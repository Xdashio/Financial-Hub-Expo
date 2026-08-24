import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography, touchTarget, type ColorPalette } from '@/theme';
import { formatMoney } from '@/utils/money';
import { RunwayVisualization } from './RunwayVisualization';
import { usePlanningCycleStatus, useCurrentPlanningCycle, useTriggerPlanningCycle, usePlanningCycleHistory } from '@/hooks/useFreelancer';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { PocketGlyph } from '@/components/ui/PocketGlyph';
import { PocketLoader } from '@/components/ui/PocketLoader';
import { AlertTriangle, Calendar } from 'lucide-react-native';

export function PlanningCycleScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [refreshing, setRefreshing] = useState(false);
  const [showTriggerConfirm, setShowTriggerConfirm] = useState(false);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = usePlanningCycleStatus();
  const { data: currentCycle, isLoading: cycleLoading, refetch: refetchCycle } = useCurrentPlanningCycle();
  const { data: history, isLoading: historyLoading } = usePlanningCycleHistory(6);
  const triggerMutation = useTriggerPlanningCycle();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStatus(), refetchCycle()]);
    setRefreshing(false);
  };

  const handleTrigger = async () => {
    setShowTriggerConfirm(false);
    try {
      await triggerMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to trigger planning cycle:', error);
    }
  };

  const nextPlanningDate = status?.next_planning_date;
  const daysUntilNext = status?.days_until_next ?? 0;
  const lastCycleAt = status?.last_planning_cycle_at;

  const cycleMonth = currentCycle?.cycle_month;
  const allocations = currentCycle?.allocations ?? [];
  const recommendations = currentCycle?.recommendations ?? [];

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
      {/* Status Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Calendar size={24} color={colors.emeraldDeep} strokeWidth={2} />
          </View>
          <View style={styles.headerContent}>
            <Text style={[typography.heading, { color: colors.ink }]}>Monthly Planning Cycle</Text>
            <Text style={[typography.caption, { color: colors.sage, marginTop: 2 }]}>
              Runs on day {status?.monthly_planning_day} of each month
            </Text>
          </View>
        </View>

        <View style={styles.nextCycleInfo}>
          <View style={styles.nextCycleItem}>
            <Text style={[typography.caption, { color: colors.sage }]}>Next Planning</Text>
            <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
              {nextPlanningDate ? new Date(nextPlanningDate).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }) : '—'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.nextCycleItem}>
            <Text style={[typography.caption, { color: colors.sage }]}>In</Text>
            <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
              {daysUntilNext > 0 ? `${daysUntilNext} day${daysUntilNext !== 1 ? 's' : ''}` : 'Today'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.nextCycleItem}>
            <Text style={[typography.caption, { color: colors.sage }]}>Last Run</Text>
            <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
              {lastCycleAt ? new Date(lastCycleAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
            </Text>
          </View>
        </View>

        {triggerMutation.isPending && (
          <View style={styles.triggeringBanner}>
            <PocketLoader size={16} color={colors.emeraldDeep} />
            <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginLeft: spacing.sm }}>
              Running planning cycle…
            </Text>
          </View>
        )}

        <Pressable 
          style={[
            styles.triggerButton,
            triggerMutation.isPending && styles.triggerButtonDisabled
          ]}
          onPress={() => setShowTriggerConfirm(true)}
          disabled={triggerMutation.isPending}
        >
          <Text style={[typography.body, { color: colors.surface, fontWeight: '600' }]}>
            Run Planning Cycle Now
          </Text>
        </Pressable>
      </View>

      {/* Current Cycle Results */}
      {currentCycle && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[typography.heading, { color: colors.ink }]}>
              Current Cycle ({cycleMonth ? new Date(cycleMonth).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' }) : 'This Month'})
            </Text>
            {currentCycle.message && (
              <Text style={{ ...typography.caption, color: colors.sage }}>
                {currentCycle.message}
              </Text>
            )}
          </View>

          {/* Runway Summary */}
          <RunwayVisualization 
            runway={{
              applicable: true,
              runwayDays: currentCycle.runway_days,
              expectedIntervalDays: 30,
              dailyBudget: currentCycle.daily_budget,
              discretionaryReserve: currentCycle.discretionary_reserve,
              fixedObligations: currentCycle.total_fixed_obligations,
              confidence: 'historical',
            }} 
            showDetails={true}
          />

          {/* Fixed Expense Allocations */}
          {allocations.length > 0 && (
            <View style={styles.section}>
              <Text style={[typography.heading, { color: colors.ink, marginBottom: spacing.md }]}>
                Fixed Expense Allocations
              </Text>
              <View style={styles.allocationsList}>
                {allocations.map((alloc) => (
                  <View key={alloc.expenseId} style={styles.allocationRow}>
                    <View style={styles.allocationInfo}>
                      <Text style={[typography.body, { color: colors.ink }]}>{alloc.name}</Text>
                      <View style={styles.allocationMeta}>
                        <Text style={[typography.caption, { color: colors.sage }]}>
                          Monthly: {formatMoney(alloc.amount)}
                        </Text>
                        {alloc.carryForwardAmount > 0 && (
                          <>
                            <Text style={[typography.caption, { color: colors.emeraldDeep, marginLeft: spacing.sm }]}>
                              Carried forward: {formatMoney(alloc.carryForwardAmount)}
                            </Text>
                          </>
                        )}
                        {alloc.previousCarryForward < 0 && (
                          <>
                            <Text style={[typography.caption, { color: colors.clay, marginLeft: spacing.sm }]}>
                              Underfunded: {formatMoney(Math.abs(alloc.previousCarryForward))}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={styles.allocationFunded}>
                      <Text style={[typography.caption, { color: colors.sage }]}>This Cycle</Text>
                      <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                        {formatMoney(alloc.fundedAmount)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Behavioral Recommendations */}
          {recommendations.length > 0 && (
            <View style={styles.section}>
              <View style={styles.recommendationsHeader}>
                <Text style={[typography.heading, { color: colors.ink }]}>Allocation Recommendations</Text>
                <Text style={{ ...typography.caption, color: colors.sage }}>
                  Based on {recommendations[0]?.basedOnCycles || 0} months of history
                </Text>
              </View>
              <View style={styles.recommendationsList}>
                {recommendations.map((rec) => {
                  const badgeBg = rec.confidence === 'high' ? colors.emeraldTint :
                                 rec.confidence === 'medium' ? colors.goldTint :
                                 colors.clayTint;
                  const badgeColor = rec.confidence === 'high' ? colors.emeraldDeep :
                                   rec.confidence === 'medium' ? colors.gold :
                                   colors.clay;
                  return (
                    <Pressable
                      key={rec.expenseId}
                      style={styles.recommendationCard}
                      onPress={() => {
                        // Could open a modal to accept/modify
                      }}
                    >
                      <View style={styles.recInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                          <Text style={[typography.body, { color: colors.ink }]}>{rec.name}</Text>
                          <View style={[
                            styles.confidenceBadge,
                            { backgroundColor: badgeBg }
                          ]}>
                            <Text style={[
                              typography.caption, 
                              { color: badgeColor }
                            ]}>
                              {rec.confidence}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                          {rec.reason}
                        </Text>
                      </View>
                      <View style={styles.recComparison}>
                        <View style={styles.recValue}>
                          <Text style={{ ...typography.caption, color: colors.sage }}>Current</Text>
                          <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                            {formatMoney(rec.currentAllocation)}
                          </Text>
                        </View>
                        <View style={styles.arrowCenter}>
                          <Text style={{ ...typography.body, color: colors.sage }}>→</Text>
                        </View>
                        <View style={{ ...styles.recValue, alignItems: 'flex-end' }}>
                          <Text style={{ ...typography.caption, color: colors.sage }}>Recommended</Text>
                          <Text style={[typography.body, { color: colors.emeraldDeep, fontVariant: ['tabular-nums'] }]}>
                            {formatMoney(rec.recommendedAllocation)}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[typography.caption, { color: colors.sage }]}>Reserve at Start</Text>
                <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                  {formatMoney(currentCycle.reserve_balance_at_start)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[typography.caption, { color: colors.sage }]}>Fixed Obligations</Text>
                <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                  {formatMoney(currentCycle.total_fixed_obligations)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[typography.caption, { color: colors.sage }]}>Discretionary Reserve</Text>
                <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                  {formatMoney(currentCycle.discretionary_reserve)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[typography.caption, { color: colors.sage }]}>Daily Budget</Text>
                <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                  {formatMoney(currentCycle.daily_budget)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[typography.caption, { color: colors.sage }]}>Runway</Text>
                <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                  {currentCycle.runway_days} days
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* History */}
      {history && history.length > 0 && (
        <View style={styles.section}>
          <Text style={[typography.heading, { color: colors.ink, marginBottom: spacing.md }]}>
            Planning Cycle History
          </Text>
          <View style={styles.historyList}>
            {history.map((cycle) => (
              <View key={cycle.cycle_month} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={[typography.body, { color: colors.ink }]}>
                    {new Date(cycle.cycle_month).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text style={[typography.caption, { color: colors.sage }]}>
                    Run: {new Date(cycle.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.historyStats}>
                  <View style={styles.historyStat}>
                    <Text style={[typography.caption, { color: colors.sage }]}>Runway</Text>
                    <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                      {cycle.runway_days} days
                    </Text>
                  </View>
                  <View style={styles.historyStat}>
                    <Text style={[typography.caption, { color: colors.sage }]}>Daily Budget</Text>
                    <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                      {formatMoney(cycle.daily_budget)}
                    </Text>
                  </View>
                  <View style={styles.historyStat}>
                    <Text style={[typography.caption, { color: colors.sage }]}>Fixed Obligations</Text>
                    <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                      {formatMoney(cycle.total_fixed_obligations)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Trigger Confirmation Modal */}
      <BottomSheetModal visible={showTriggerConfirm} onClose={() => setShowTriggerConfirm(false)} title="Run Planning Cycle Now?" headerGlyph={<PocketGlyph kind="locked" size={16} color={colors.emeraldDeep} />}>
        <View style={styles.confirmModal}>
          <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
            <Calendar size={28} color={colors.emeraldDeep} strokeWidth={2} />
          </View>
          <Text style={{ ...typography.heading, color: colors.ink, textAlign: 'center', marginBottom: spacing.sm }}>
            Run Monthly Planning Cycle
          </Text>
          <Text style={{ ...typography.body, color: colors.sage, textAlign: 'center', marginBottom: spacing.lg }}>
            This will audit last month's spending, allocate fixed expenses for the new cycle, recalculate your daily budget, and generate new behavioral recommendations. This normally runs automatically on day {status?.monthly_planning_day}.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
            <Button variant="secondary" onPress={() => setShowTriggerConfirm(false)} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button variant="primary" onPress={handleTrigger} loading={triggerMutation.isPending} style={{ flex: 1 }}>
              Run Now
            </Button>
          </View>
        </View>
      </BottomSheetModal>
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.lg,
  },
  headerCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  nextCycleInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  nextCycleItem: {
    alignItems: 'center',
    flex: 1,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: colors.lineSoft,
  },
  triggeringBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.emeraldTint,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  triggerButton: {
    padding: spacing.md,
    backgroundColor: colors.emeraldDeep,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  triggerButtonDisabled: {
    opacity: 0.6,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  allocationsList: {
    gap: spacing.md,
  },
  allocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  allocationInfo: {
    flex: 1,
  },
  allocationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  allocationFunded: {
    alignItems: 'flex-end',
    minWidth: 100,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  recommendationsList: {
    gap: spacing.md,
  },
  recommendationCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  recInfo: {
    flex: 1,
    marginBottom: spacing.sm,
  },
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  recComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  recValue: {
    alignItems: 'center',
  },
  arrowCenter: {
    marginHorizontal: spacing.md,
  },
  summaryCard: {
    padding: spacing.md,
    backgroundColor: colors.emeraldTint,
    borderRadius: radius.md,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    width: '33%',
    marginBottom: spacing.sm,
  },
  historyList: {
    gap: spacing.md,
  },
  historyCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyStat: {
    alignItems: 'center',
  },
  confirmModal: {
    paddingVertical: spacing.md,
  },
  });
}