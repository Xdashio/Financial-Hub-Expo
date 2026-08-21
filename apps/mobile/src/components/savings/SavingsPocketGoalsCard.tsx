import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography, borderWidth } from '@/theme';
import { Target, TrendingUp, Award, Calendar } from 'lucide-react-native';
import { formatMoney } from '@/utils/money';

/**
 * SavingsPocketGoalsCard
 *
 * Replaces the standalone SavingsGoalTracker that was embedded in the home
 * screen's savings section. It now lives inside the savings pocket detail
 * screen, where the user already has the pocket's full context.
 *
 * Design rationale:
 * - Condensed single-card layout: no repeated chrome per goal — the detail
 *   screen already provides the heading and surrounding padding.
 * - Progress expressed as a filled arc-free bar (matches every other pocket
 *   progress bar in the app) rather than a percentage pill, which read as
 *   a duplicate of the hero card above.
 * - Motivational copy is single-line and below the bar (not above), so the
 *   number is the first thing the eye lands on.
 * - "Set a target" empty state prompts action rather than describing absence.
 */

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  category?: 'emergency' | 'goal' | 'investment' | 'debt';
}

interface SavingsPocketGoalsCardProps {
  goals: SavingsGoal[];
  /** Called when the user taps "Set target" on a goal-less pocket. */
  onSetTarget?: () => void;
  /**
   * Called when the user taps "What's next?" on a goal that's hit 100%.
   * Without this, "Target reached" is a dead end — this is what wires it
   * up to an actual follow-up flow (reallocate the surplus, keep growing).
   */
  onGoalReached?: (goal: SavingsGoal) => void;
}

function statusMessage(pct: number): string {
  if (pct >= 100) return 'Target reached';
  if (pct >= 75) return 'Almost there';
  if (pct >= 50) return 'Halfway';
  if (pct >= 25) return 'Building momentum';
  return 'Getting started';
}

export function SavingsPocketGoalsCard({ goals, onSetTarget, onGoalReached }: SavingsPocketGoalsCardProps) {
  const { colors } = useTheme();

  if (goals.length === 0) {
    return (
      <Pressable
        onPress={onSetTarget}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.emeraldTint,
          borderRadius: radius.sm,
          borderWidth: borderWidth,
          borderColor: colors.emeraldDeep + '30',
          borderStyle: 'dashed',
          opacity: pressed ? 0.75 : 1,
        })}
        accessibilityRole="button"
        accessibilityLabel="Set a savings target"
      >
        <View style={{
          width: 36,
          height: 36,
          borderRadius: radius.xs,
          backgroundColor: colors.emeraldDeep + '18',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Target size={18} color={colors.emeraldDeep} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.heading, color: colors.emeraldDeep }}>
            Set a savings target
          </Text>
          <Text style={{ ...typography.caption, color: colors.emeraldDeep + 'AA', marginTop: 2 }}>
            Track progress toward a specific amount
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {goals.map((goal) => {
        const pct = Math.min(100, goal.targetAmount > 0
          ? (goal.currentAmount / goal.targetAmount) * 100
          : 0);
        const isComplete = pct >= 100;

        return (
          <View
            key={goal.id}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.sm,
              borderWidth: borderWidth,
              borderColor: isComplete ? colors.emeraldDeep + '60' : colors.line,
              padding: spacing.lg,
            }}
          >
            {/* Top row: name + badge */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing.md,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.xs,
                  backgroundColor: isComplete ? colors.emeraldTint : colors.paper,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {isComplete
                    ? <Award size={16} color={colors.emeraldDeep} strokeWidth={2} />
                    : <TrendingUp size={16} color={colors.sage} strokeWidth={2} />
                  }
                </View>
                <Text style={{ ...typography.heading, color: colors.ink, flex: 1 }} numberOfLines={1}>
                  {goal.name}
                </Text>
              </View>

              {/* Percentage pill — right-aligned, minimal */}
              <View style={{
                backgroundColor: isComplete ? colors.emeraldTint : colors.paper,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                marginLeft: spacing.sm,
              }}>
                <Text style={{
                  ...typography.caption,
                  color: isComplete ? colors.emeraldDeep : colors.sage,
                  fontVariant: ['tabular-nums'],
                }}>
                  {Math.round(pct)}%
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={{
              height: 5,
              backgroundColor: colors.lineSoft,
              borderRadius: radius.pill,
              overflow: 'hidden',
              marginBottom: spacing.sm,
            }}>
              <View style={{
                height: '100%',
                width: `${pct}%`,
                backgroundColor: isComplete ? colors.emeraldDeep : colors.emerald,
                borderRadius: radius.pill,
              }} />
            </View>

            {/* Amount row */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>
                {formatMoney(goal.currentAmount)}
                {' '}
                <Text style={{ color: colors.lineSoft }}>of</Text>
                {' '}
                {formatMoney(goal.targetAmount)}
              </Text>
              <Text style={{ ...typography.caption, color: isComplete ? colors.emeraldDeep : colors.sage }}>
                {statusMessage(pct)}
              </Text>
            </View>

            {/* Goal reached — surface a real next step instead of a dead end */}
            {isComplete && onGoalReached && (
              <Pressable
                onPress={() => onGoalReached(goal)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  marginTop: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.pill,
                  backgroundColor: colors.emeraldTint,
                  opacity: pressed ? 0.75 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel={`Decide what's next for ${goal.name}`}
              >
                <Text style={{ ...typography.caption, color: colors.emeraldDeep, fontWeight: '600' }}>
                  What's next?
                </Text>
              </Pressable>
            )}

            {/* Target date — only when set */}
            {goal.targetDate && !isComplete && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                marginTop: spacing.sm,
              }}>
                <Calendar size={11} color={colors.sage} strokeWidth={2} />
                <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>
                  {new Date(goal.targetDate).toLocaleDateString('en-KE', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}