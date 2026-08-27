import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography, touchTarget, type ColorPalette } from '@/theme';
import { formatMoney } from '@/utils/money';
import { RunwayVisualization } from './RunwayVisualization';
import { DailyAllocation } from '@financial-hub/shared';

interface DailyAllocationTodayProps {
  allocation: DailyAllocation | null;
  runway: any;
  spendablePockets: Array<{
    id: string;
    name: string;
    kind: string;
    category: string | null;
    daily_cap: number | null;
    available_balance: number;
    monthly_allocation: number;
    /** Left of today's cap, already clamped to the ledger balance. */
    today_remaining?: number;
  }>;
}

export function DailyAllocationToday({ allocation, runway, spendablePockets }: DailyAllocationTodayProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // Must be called unconditionally before any early returns (Rules of Hooks)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const pocketProgress = useMemo(() => {
    return spendablePockets.map((pocket) => {
      const cap = pocket.daily_cap ?? 0;
      const isDailyCap = pocket.daily_cap !== null && pocket.daily_cap > 0;
      // today_remaining (server-computed, clamped to both the cap and the
      // ledger) is the correct "left today" figure. available_balance is a
      // whole-cycle ledger balance and only stands in when there's no cap
      // at all (monthly progress for non-capped pockets).
      const remainingToday = isDailyCap ? (pocket.today_remaining ?? pocket.available_balance ?? 0) : 0;
      const current = isDailyCap ? Math.max(0, cap - remainingToday) : 0;
      const total = isDailyCap ? cap : pocket.monthly_allocation;
      const pct = total > 0 ? Math.min(1, current / total) : 0;
      return {
        ...pocket,
        progress: pct,
        isDailyCap,
        cap,
        available: pocket.available_balance ?? 0,
        remainingToday,
      };
    });
  }, [spendablePockets]);

  if (!allocation) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <Text style={[typography.heading, { color: colors.ink, textAlign: 'center' }]}>No Daily Allocation</Text>
          <Text style={[typography.body, { color: colors.sage, textAlign: 'center', marginTop: spacing.xs }]}>
            Your daily budget will appear here at midnight (EAT).
          </Text>
        </View>
      </View>
    );
  }

  const isClosed = allocation.status === 'closed';
  const spent = allocation.actualSpend ?? 0;
  const planned = allocation.plannedAmount ?? 0;
  const remaining = Math.max(0, planned - spent);
  const overspend = Math.max(0, spent - planned);
  const returned = allocation.returnedAmount ?? 0;
  const overspendAmount = allocation.overspendAmount ?? 0;
  const progress = planned > 0 ? Math.min(1, spent / planned) : 0;

  const runwayDaysAtOpen = allocation.runwayDaysAtOpen ?? 0;
  const runwayDaysAtClose = allocation.runwayDaysAtClose ?? null;
  const runwayDelta = runwayDaysAtClose !== null ? runwayDaysAtClose - runwayDaysAtOpen : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Runway Visualization */}
      <View style={styles.section}>
        <RunwayVisualization runway={runway} showDetails={true} />
      </View>

      {/* Today's Allocation Card */}
      <View style={styles.section}>
        <Text style={[typography.heading, { color: colors.ink, marginBottom: spacing.md }]}>
          Today&apos;s Allocation
        </Text>

        <View style={[
          styles.allocationCard,
          { backgroundColor: isClosed ? colors.surface : colors.emeraldTint }
        ]}>
          {/* Progress Ring */}
          <View style={styles.progressContainer}>
            <View style={styles.progressRing}>
              <View style={[
                styles.progressArc,
                { backgroundColor: overspend > 0 ? colors.clay : colors.emeraldDeep }
              ]}>
                <View style={styles.progressInner}>
                  <Text style={[typography.display, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                    {formatMoney(spent)}
                  </Text>
                  <Text style={[typography.caption, { color: colors.sage }]}>
                    / {formatMoney(planned)}
                  </Text>
                  <Text style={[typography.caption, { 
                    color: overspend > 0 ? colors.clay : remaining > 0 ? colors.emeraldDeep : colors.sage,
                    marginTop: 2 
                  }]}>
                    {overspend > 0 ? `Over by ${formatMoney(overspend)}` : remaining > 0 ? `${formatMoney(remaining)} remaining` : 'Fully spent'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBarContainer}>
              <View style={[
                styles.progressBar,
                { width: `${progress * 100}%` },
                { backgroundColor: overspend > 0 ? colors.clay : colors.emeraldDeep }
              ]} />
            </View>
          </View>

          {/* Status badges */}
          <View style={styles.statusRow}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: isClosed ? colors.lineSoft : colors.emeraldTint }
            ]}>
              <Text style={[typography.caption, { color: isClosed ? colors.sage : colors.emeraldDeep }]}>
                {isClosed ? 'Closed' : 'Active'}
              </Text>
            </View>
            
            {returned > 0 && (
              <View style={[styles.statusBadge, { backgroundColor: colors.emeraldTint }]}>
                <Text style={[typography.caption, { color: colors.emeraldDeep }]}>
                  Returned: {formatMoney(returned)}
                </Text>
              </View>
            )}

            {overspendAmount > 0 && (
              <View style={[styles.statusBadge, { backgroundColor: colors.clayTint }]}>
                <Text style={[typography.caption, { color: colors.clay }]}>
                  Overspend: {formatMoney(overspendAmount)}
                </Text>
              </View>
            )}

            {runwayDaysAtClose !== null && runwayDelta !== 0 && (
              <View style={[styles.statusBadge, { backgroundColor: runwayDelta > 0 ? colors.emeraldTint : colors.clayTint }]}>
                <Text style={[typography.caption, { color: runwayDelta > 0 ? colors.emeraldDeep : colors.clay }]}>
                  Runway {runwayDelta > 0 ? '+' : ''}{runwayDelta} days
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Spendable Pockets with Daily Caps */}
      {spendablePockets.length > 0 && (
        <View style={styles.section}>
          <Text style={[typography.heading, { color: colors.ink, marginBottom: spacing.md }]}>
            Today&apos;s Pocket Budgets
          </Text>
          <View style={styles.pocketsList}>
            {spendablePockets.map((pocket) => {
              const cap = pocket.daily_cap ?? 0;
              const isDailyCap = pocket.daily_cap !== null && pocket.daily_cap > 0;
              const remainingToday = isDailyCap ? (pocket.today_remaining ?? pocket.available_balance ?? 0) : 0;
              const used = isDailyCap ? Math.max(0, cap - remainingToday) : 0;
              const pocketProgress = isDailyCap && cap > 0 ? Math.min(1, used / cap) : 0;

              return (
                <View key={pocket.id} style={styles.pocketRow}>
                  <View style={styles.pocketInfo}>
                    <Text style={[typography.body, { color: colors.ink }]}>{pocket.name}</Text>
                    <View style={styles.pocketMeta}>
                      <Text style={[typography.caption, { color: colors.sage }]}>
                        {isDailyCap ? `Daily cap: ${formatMoney(cap)}` : `Monthly: ${formatMoney(pocket.monthly_allocation)}`}
                      </Text>
                      {isDailyCap && (
                        <Text style={[typography.caption, { color: colors.sage, marginLeft: spacing.sm }]}>
                          Used: {formatMoney(used)}
                        </Text>
                      )}
                    </View>
                  </View>
                  {isDailyCap && (
                    <View style={styles.pocketProgress}>
                      <View style={[
                        styles.miniProgressBar,
                        { width: `${pocketProgress * 100}%` },
                        { backgroundColor: pocketProgress >= 1 ? colors.clay : colors.emeraldDeep }
                      ]} />
                      <Text style={[typography.caption, { color: colors.sage, minWidth: 50, textAlign: 'right' }]}>
                        {Math.round(pocketProgress * 100)}%
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Runway Delta Explanation */}
      {runwayDaysAtClose !== null && runwayDelta !== 0 && (
        <View style={styles.explanation}>
          <Text style={[typography.heading, { color: colors.ink, marginBottom: spacing.xs }]}>
            Runway Change
          </Text>
          <Text style={[typography.body, { color: colors.sage }]}>
            {runwayDelta > 0
              ? `You spent ${formatMoney(planned - spent)} under budget today. ${formatMoney(planned - spent)} returned to Reserve, extending your runway by ${Math.abs(runwayDelta)} day(s).`
              : `You overspent by ${formatMoney(spent - planned)} today. This reduced your Reserve, shortening your runway by ${Math.abs(runwayDelta)} day(s).`}
          </Text>
        </View>
      )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  section: {
    marginBottom: spacing.lg,
  },
  allocationCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  progressRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressArc: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
  },
  progressInner: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: colors.lineSoft,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressBar: {
    height: '100%',
    borderRadius: radius.pill,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  pocketsList: {
    gap: spacing.md,
  },
  pocketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pocketInfo: {
    flex: 1,
  },
  pocketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  pocketProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 120,
  },
  miniProgressBar: {
    height: 6,
    borderRadius: radius.pill,
    flex: 1,
    maxWidth: 80,
  },
  explanation: {
    padding: spacing.md,
    backgroundColor: colors.goldTint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  });
}