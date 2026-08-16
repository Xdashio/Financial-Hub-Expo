import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography } from '@/theme';
import { Sparkles, Check, Target, Calendar, Award } from 'lucide-react-native';
import { formatMoney } from '@/utils/money';
import { CategoryIcon } from '@/components/icons';

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  category: 'emergency' | 'goal' | 'investment' | 'debt';
  createdAt: string;
}

interface SavingsGoalTrackerProps {
  goals: SavingsGoal[];
  onGoalUpdate?: (goalId: string, amount: number) => void;
}

/**
 * Savings Goal Tracker with milestone celebrations and progress visualization.
 * Based on financial psychology research showing that:
 * - Specific targets improve savings rates as goals near completion
 * - Progress visualization provides immediate feedback
 * - Non-judgmental encouragement supports long-term engagement
 * - Milestone celebrations reinforce positive behavior
 */
export function SavingsGoalTracker({ goals, onGoalUpdate }: SavingsGoalTrackerProps) {
  const { colors } = useTheme();
  const [celebratingGoal, setCelebratingGoal] = useState<string | null>(null);
  const [showMilestone, setShowMilestone] = useState<{ goalId: string; percentage: number } | null>(null);
  
  const celebrateAnim = React.useRef(new Animated.Value(0));
  const progressAnim = React.useRef(new Animated.Value(0));

  // Check for goal achievements
  useEffect(() => {
    goals.forEach(goal => {
      const percentage = (goal.currentAmount / goal.targetAmount) * 100;
      
      // Check if goal just reached 100%
      if (percentage >= 100 && celebratingGoal !== goal.id) {
        setCelebratingGoal(goal.id);
        
        Animated.sequence([
          Animated.timing(celebrateAnim.current, {
            toValue: 1,
            duration: 800,
            easing: Easing.back(1.7),
            useNativeDriver: true,
          }),
          Animated.timing(celebrateAnim.current, {
            toValue: 0,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();

        setTimeout(() => setCelebratingGoal(null), 3000);
      }
      
      // Check for milestone (25%, 50%, 75%)
      const milestones = [25, 50, 75];
      if (milestones.includes(Math.floor(percentage)) && showMilestone?.goalId !== goal.id) {
        setShowMilestone({ goalId: goal.id, percentage: Math.floor(percentage) });
        setTimeout(() => setShowMilestone(null), 2000);
      }
    });
  }, [goals, celebratingGoal, showMilestone]);

  // Animate progress bars
  useEffect(() => {
    goals.forEach(goal => {
      const percentage = Math.min(1, goal.currentAmount / goal.targetAmount);
      Animated.timing(progressAnim.current, {
        toValue: percentage,
        duration: 500,
        easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start();
    });
  }, [goals]);

  const getCategoryColor = (category: string) => {
    // Use the centralized color system
    switch (category) {
      case 'emergency': return colors.emeraldDeep;
      case 'goal': return colors.gold;
      case 'investment': return colors.plum;
      case 'debt': return colors.clay;
      default: return colors.emeraldDeep;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'emergency': return 'Emergency Fund';
      case 'goal': return 'Savings Goal';
      case 'investment': return 'Investment';
      case 'debt': return 'Debt Repayment';
      default: return 'Savings';
    }
  };

  const getProgressMessage = (percentage: number, category: string) => {
    if (percentage >= 100) {
      return category === 'emergency' 
        ? 'Emergency fund target reached - excellent financial resilience'
        : category === 'debt'
        ? 'Debt repayment goal achieved - financial freedom milestone'
        : 'Goal achieved - ready for next financial milestone';
    }
    if (percentage >= 75) return 'Almost there - final push to reach your target';
    if (percentage >= 50) return 'Halfway to your goal - consistent progress';
    if (percentage >= 25) return 'Building momentum - keep up the great work';
    return 'Starting your journey - every contribution counts';
  };

  if (goals.length === 0) {
    return (
      <View style={{ alignItems: 'center', padding: spacing.xl }}>
        <Target size={32} color={colors.sage} strokeWidth={2} style={{ marginBottom: spacing.md }} />
        <Text style={{ ...typography.body, color: colors.sage, textAlign: 'center' }}>
          Set savings goals to track your financial progress
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {showMilestone && (
        <Animated.View style={{ opacity: celebrateAnim.current }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.md,
            backgroundColor: colors.goldTint,
            borderRadius: radius.md,
            marginBottom: spacing.md,
          }}>
            <Sparkles size={18} color={colors.gold} strokeWidth={2} style={{ marginRight: spacing.xs }} />
            <Text style={{ ...typography.caption, color: colors.gold }}>
              {showMilestone.percentage}% milestone reached
            </Text>
          </View>
        </Animated.View>
      )}

      {goals.map((goal) => {
        const percentage = (goal.currentAmount / goal.targetAmount) * 100;
        const categoryColor = getCategoryColor(goal.category);
        const isComplete = percentage >= 100;
        const isCelebrating = celebratingGoal === goal.id;

        return (
          <Animated.View
            key={goal.id}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: isComplete ? categoryColor : colors.line,
              borderRadius: radius.md,
              padding: spacing.lg,
              transform: isCelebrating ? [{ scale: celebrateAnim.current }] : undefined,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: radius.md, 
                  backgroundColor: `${categoryColor}20`, 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <CategoryIcon category={goal.category} size={18} color={categoryColor} />
                </View>
                <View>
                  <Text style={{ ...typography.heading, color: colors.ink }}>{goal.name}</Text>
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                    {getCategoryLabel(goal.category)}
                  </Text>
                </View>
              </View>
              {isComplete && (
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: spacing.xs,
                  backgroundColor: colors.goldTint,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.pill,
                }}>
                  <Award size={14} color={colors.gold} strokeWidth={2} />
                  <Text style={{ ...typography.caption, color: colors.gold, fontSize: 11 }}>
                    Achieved
                  </Text>
                </View>
              )}
            </View>

            <View style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.xs }}>
                <Text style={{ ...typography.caption, color: colors.sage }}>
                  {isComplete ? 'Target reached' : 'Progress'}
                </Text>
                <Text style={{ ...typography.heading, color: colors.ink, fontSize: 16 }}>
                  {percentage.toFixed(0)}%
                </Text>
              </View>
              <View style={{ 
                height: 8, 
                backgroundColor: colors.lineSoft, 
                borderRadius: radius.pill, 
                overflow: 'hidden' 
              }}>
                <Animated.View
                  style={{
                    height: '100%',
                    borderRadius: radius.pill,
                    backgroundColor: categoryColor,
                    width: `${percentage}%`,
                  }}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
                <Text style={{ ...typography.caption, color: colors.sage }}>
                  {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                </Text>
                <Text style={{ ...typography.caption, color: colors.sage }}>
                  {formatCurrency(goal.targetAmount - goal.currentAmount)} remaining
                </Text>
              </View>
            </View>

            <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center', marginTop: spacing.sm, lineHeight: 16 }}>
              {getProgressMessage(percentage, goal.category)}
            </Text>

            {goal.targetDate && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, justifyContent: 'center' }}>
                <Calendar size={12} color={colors.sage} strokeWidth={2} />
                <Text style={{ ...typography.caption, color: colors.sage, fontSize: 11 }}>
                  Target: {new Date(goal.targetDate).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

function formatCurrency(amount: number): string {
  return formatMoney(amount);
}