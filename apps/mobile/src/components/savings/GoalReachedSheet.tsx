import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, borderWidth } from '@/theme';
import { ArrowLeftRight, PiggyBank, Lock, Unlock } from 'lucide-react-native';
import { formatMoney } from '@/utils/money';
import { BottomSheetModal } from '@/components/ui';

interface GoalReachedSheetProps {
  visible: boolean;
  onClose: () => void;
  pocketId: string;
  pocketName: string;
  amount: number;
  /** Whether the pocket is time-locked (funds cannot be moved) */
  isTimeLocked: boolean;
  /** Called after the user chooses to keep the goal running for another cycle. */
  onKeepGrowing: () => void;
  /** Called when user wants to unlock early to access funds */
  onUnlockEarly?: () => void;
  /** Called when user wants to unlock early with goal-reached waiver (no discipline cost) */
  onUnlockWithGoalWaiver?: () => void;
}

/**
 * The follow-up flow for a savings pocket that has hit its target.
 *
 * Previously "Target reached" was a dead end — a badge and a line of copy,
 * with nothing to actually do next. This sheet gives the user two real,
 * fully-wired next steps instead of leaving them stuck at the finish line:
 *
 * 1. Move the money — hands off to the existing reallocation flow with the
 *    source pocket and full balance pre-filled, so the saved amount can be
 *    put to work elsewhere (another goal, a fixed expense, spending).
 * 2. Keep growing — acknowledges the milestone and explicitly keeps the
 *    pocket accumulating toward its next target, rather than silently
 *    reshowing "Target reached" forever with no sense of what happens next.
 */
export function GoalReachedSheet({
  visible,
  onClose,
  pocketId,
  pocketName,
  amount,
  isTimeLocked,
  onKeepGrowing,
  onUnlockEarly,
  onUnlockWithGoalWaiver,
}: GoalReachedSheetProps) {
  const router = useRouter();
  const { colors } = useTheme();

  const handleReallocate = () => {
    onClose();
    setTimeout(() => {
      router.push({
        pathname: '/(modals)/realloc-pick',
        params: { fromId: pocketId, amount: String(amount) },
      });
    }, 200);
  };

  const handleUnlockWithGoalWaiver = () => {
    onClose();
    if (onUnlockWithGoalWaiver) {
      onUnlockWithGoalWaiver();
    }
  };

  const handleKeepGrowing = () => {
    onClose();
    onKeepGrowing();
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Goal reached"
    >
      <Text style={{ ...typography.body, color: colors.ink, marginBottom: spacing.lg, lineHeight: 20 }}>
        {pocketName} hit its target with {formatMoney(amount)} saved. What would you like to do with it?
      </Text>

      <View style={{ gap: spacing.sm }}>
        {!isTimeLocked && (
          <Pressable
            onPress={handleReallocate}
            style={({ pressed }) => [{
              backgroundColor: colors.surface,
              borderWidth,
              borderColor: colors.line,
              borderRadius: radius.sm,
              padding: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }, { opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Move this money to another pocket"
          >
            <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.plumTint, alignItems: 'center', justifyContent: 'center' }}>
              <ArrowLeftRight size={20} color={colors.plum} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, color: colors.ink }}>Move it to another pocket</Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                Put the {formatMoney(amount)} toward a fixed expense, another goal, or spending
              </Text>
            </View>
          </Pressable>
        )}

        {isTimeLocked && (
          <Pressable
            onPress={handleUnlockWithGoalWaiver}
            style={({ pressed }) => [{
              backgroundColor: colors.emeraldTint,
              borderWidth,
              borderColor: colors.emeraldDeep + '40',
              borderRadius: radius.sm,
              padding: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }, { opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Unlock the pocket early with no discipline cost"
          >
            <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.emeraldDeep + '15', alignItems: 'center', justifyContent: 'center' }}>
              <Unlock size={20} color={colors.emeraldDeep} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, color: colors.emeraldDeep }}>Unlock early (free)</Text>
              <Text style={{ ...typography.caption, color: colors.emeraldDeep + 'CC', marginTop: 2 }}>
                You've reached your goal! Unlocking is free as a reward for your discipline
              </Text>
            </View>
          </Pressable>
        )}

        <Pressable
          onPress={handleKeepGrowing}
          style={({ pressed }) => [{
            backgroundColor: colors.surface,
            borderWidth,
            borderColor: colors.line,
            borderRadius: radius.sm,
            padding: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }, { opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Set a new goal for this pocket"
        >
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }}>
            <PiggyBank size={20} color={colors.emeraldDeep} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.body, color: colors.ink }}>Set a new goal</Text>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
              Create a new target or expand the current goal for this pocket
            </Text>
          </View>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}