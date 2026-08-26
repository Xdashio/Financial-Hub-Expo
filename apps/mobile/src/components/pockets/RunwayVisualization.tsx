import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography, type ColorPalette } from '@/theme';
import { formatMoney } from '@/utils/money';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { RunwaySummary } from '@financial-hub/shared';

interface RunwayVisualizationProps {
  runway: RunwaySummary | { applicable: boolean };
  showDetails?: boolean;
}

export function RunwayVisualization({ runway, showDetails = true }: RunwayVisualizationProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const applicable = 'applicable' in runway ? runway.applicable : false;
  const runwayDays = applicable ? (runway as RunwaySummary).runwayDays ?? 0 : 0;
  const discretionaryReserve = applicable ? (runway as RunwaySummary).discretionaryReserve ?? 0 : 0;
  const fixedObligations = applicable ? (runway as RunwaySummary).fixedObligations ?? 0 : 0;
  const dailyBudget = applicable ? (runway as RunwaySummary).dailyBudget ?? 0 : 0;
  const expectedIntervalDays = applicable ? (runway as RunwaySummary).expectedIntervalDays ?? 0 : 0;
  const confidence = applicable ? (runway as RunwaySummary).confidence : undefined;

  if (!applicable) {
    return (
      <View style={styles.container}>
        <View style={styles.notApplicable}>
          <Text style={[typography.heading, { color: colors.ink }]}>Runway</Text>
          <Text style={[typography.body, { color: colors.sage, marginTop: spacing.xs }]}>
            Runway is only available for Freelancer Daily Budget plans.
          </Text>
        </View>
      </View>
    );
  }

  const progress = expectedIntervalDays > 0 ? Math.min(1, runwayDays / expectedIntervalDays) : 0;

  return (
    <View style={styles.container}>
      {/* Main Runway Ring */}
      <View style={styles.mainRing}>
        <ProgressRing
          progress={progress}
          size={120}
          strokeWidth={8}
          trackColor={colors.lineSoft}
          color={runwayDays <= 3 ? colors.clay : runwayDays <= 7 ? colors.gold : colors.emeraldDeep}
        >
          <View style={styles.centerContent}>
            <Text style={[typography.display, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
              {runwayDays}
            </Text>
            <Text style={[typography.caption, { color: colors.sage, marginTop: 2 }]}>days</Text>
          </View>
        </ProgressRing>
      </View>

      {/* Key Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={[typography.caption, { color: colors.sage }]}>Discretionary</Text>
          <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 }]}>
            {formatMoney(discretionaryReserve)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[typography.caption, { color: colors.sage }]}>Daily Budget</Text>
          <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 }]}>
            {formatMoney(dailyBudget)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[typography.caption, { color: colors.sage }]}>Fixed Obligations</Text>
          <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 }]}>
            {formatMoney(fixedObligations)}
          </Text>
        </View>
      </View>

      {showDetails && (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={[typography.caption, { color: colors.sage }]}>Expected Cycle</Text>
            <Text style={[typography.caption, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
              {expectedIntervalDays} days
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[typography.caption, { color: colors.sage }]}>Confidence</Text>
            <Text style={[typography.caption, { color: colors.ink, textTransform: 'capitalize' }]}>
              {confidence}
            </Text>
          </View>
        </View>
      )}

      {/* Visual breakdown: Fixed vs Discretionary */}
      {showDetails && fixedObligations > 0 && (
        <View style={styles.breakdown}>
          <Text style={[typography.heading, { color: colors.ink, marginBottom: spacing.sm }]}>
            Reserve Breakdown
          </Text>
          <View style={styles.breakdownBarContainer}>
            <View style={styles.breakdownBar}>
              <View
                style={{
                  ...styles.breakdownSegment,
                  width: `${(discretionaryReserve / (discretionaryReserve + fixedObligations)) * 100}%`,
                  backgroundColor: colors.emeraldDeep,
                }}
              />
              <View
                style={{
                  ...styles.breakdownSegment,
                  width: `${(fixedObligations / (discretionaryReserve + fixedObligations)) * 100}%`,
                  backgroundColor: colors.gold,
                }}
              />
            </View>
            <View style={styles.breakdownLegend}>
              <View style={styles.legendItem}>
                <View style={{ width: 12, height: 12, borderRadius: radius.xs, backgroundColor: colors.emeraldDeep }} />
                <Text style={[typography.caption, { color: colors.ink, marginLeft: spacing.xs }]}>
                  Discretionary: {formatMoney(discretionaryReserve)}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={{ width: 12, height: 12, borderRadius: radius.xs, backgroundColor: colors.gold }} />
                <Text style={[typography.caption, { color: colors.ink, marginLeft: spacing.xs }]}>
                  Fixed Obligations: {formatMoney(fixedObligations)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
  container: {
    width: '100%',
  },
  notApplicable: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  mainRing: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  centerContent: {
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  detailRow: {
    alignItems: 'center',
  },
  breakdown: {
    marginTop: spacing.md,
  },
  breakdownBarContainer: {
    marginBottom: spacing.md,
  },
  breakdownBar: {
    flexDirection: 'row',
    height: 24,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  breakdownSegment: {
    height: '100%',
  },
  breakdownLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  });
}