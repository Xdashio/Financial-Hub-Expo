import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useOnboardingStore } from '@/services/onboarding-store';
import { Button, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft, Wallet, AlertCircle, Clock } from 'lucide-react-native';
import { SpendingHabit } from '@financial-hub/shared';

const HABIT_OPTIONS = [
  {
    id: 'tracker',
    label: 'I track closely, rarely surprised',
    description: 'You check balances often',
    icon: Wallet,
  },
  {
    id: 'week3',
    label: 'I notice around week 3',
    description: 'Some months tighter than others',
    icon: Clock,
  },
  {
    id: 'off_guard',
    label: 'It catches me off guard',
    description: 'Income arrives irregularly',
    icon: AlertCircle,
  },
] as const;

export default function HabitsScreen() {
  const router = useRouter();
  const { setHabitsData, previewPlan, input, goBack } = useOnboardingStore();
  
  const [spendingHabit, setSpendingHabit] = React.useState<SpendingHabit>('tracker');
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (input.spendingHabit) setSpendingHabit(input.spendingHabit);
  }, [input]);

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      setHabitsData({ spendingHabit: spendingHabit as any });
      await previewPlan();
    } catch (error) {
      // Error handled by store
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <SafeScrollView>
        <BrandHeader onBack={() => goBack()} />
        <ProgressIndicator currentStep={2} totalSteps={4} />

        <View style={styles.header}>
          <Text style={styles.eyebrow}>Step 2 of 4 — Spending habits</Text>
          <Text style={styles.title}>When money runs low near month-end, what usually happens?</Text>
          <Text style={styles.subtext}>There&apos;s no wrong answer — this helps us understand your rhythm, not judge it.</Text>
        </View>

        <SectionTitle>Your pattern</SectionTitle>
        <View style={styles.options}>
          {HABIT_OPTIONS.map((option) => (
            <TouchableOption
              key={option.id}
              selected={spendingHabit === option.id}
              onPress={() => setSpendingHabit(option.id)}
              accessibilityLabel={`Select ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: spendingHabit === option.id }}
            >
              <View style={styles.optionIcon}>
                <option.icon size={18} color={spendingHabit === option.id ? '#fff' : colors.ink} strokeWidth={2} />
              </View>
              <View style={styles.optionText}>
                <Text style={[
                  styles.optionTitle,
                  spendingHabit === option.id && styles.optionTitleSelected,
                ]}>{option.label}</Text>
                <Text style={[
                  styles.optionDesc,
                  spendingHabit === option.id && styles.optionDescSelected,
                ]}>{option.description}</Text>
              </View>
              {spendingHabit === option.id && (
                <View style={styles.optionCheck}>
                  <View style={styles.checkMark} />
                </View>
              )}
            </TouchableOption>
          ))}
        </View>

        <Button
          fullWidth
          size="lg"
          loading={isLoading}
          onPress={handleContinue}
          rightIcon={<ChevronLeft size={18} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />}
        >
          Continue
        </Button>
      </SafeScrollView>
    </ScreenContainer>
  );
}

import React from 'react';

function TouchableOption({ 
  children, 
  selected, 
  onPress, 
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
}: any) {
  return (
    <TouchableOpacity
      style={[
        styles.optionCard,
        selected && styles.optionCardSelected,
        { minHeight: touchTarget.minHeight * 2 },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.sage,
  },
  title: {
    ...typography.display,
    fontWeight: '800',
    color: colors.ink,
    marginTop: spacing.sm,
  },
  subtext: {
    ...typography.body,
    color: colors.sage,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  options: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.lg,
  },
  optionCardSelected: {
    borderColor: colors.emeraldDeep,
    backgroundColor: colors.emeraldDeep,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...typography.heading,
    fontWeight: '600',
    color: colors.ink,
  },
  optionTitleSelected: {
    color: '#fff',
  },
  optionDesc: {
    ...typography.caption,
    fontSize: 12,
    color: colors.sage,
    marginTop: 2,
  },
  optionDescSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  optionCheck: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: '#fff',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    transform: [{ rotate: '45deg' }],
  },
});