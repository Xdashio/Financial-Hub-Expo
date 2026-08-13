import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, shadow, touchTarget } from '@/theme';
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
  const { colors } = useTheme();
  const { setHabitsData, input } = useOnboardingStore();
  
  const [spendingHabit, setSpendingHabit] = React.useState<SpendingHabit>('tracker');
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (input.spendingHabit) setSpendingHabit(input.spendingHabit);
  }, [input]);

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      setHabitsData({ spendingHabit: spendingHabit as any });
      router.push('/(onboarding)/about-you');
    } catch (error) {
      Alert.alert('Error', 'Could not save your spending habits. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <SafeScrollView>
        <BrandHeader onBack={() => {}} fallbackHref="/(onboarding)/about-you" />
        <ProgressIndicator currentStep={2} totalSteps={6} />

        <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.sage }}>Step 2 of 5 — Spending habits</Text>
          <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm }}>When money runs low near month-end, what usually happens?</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, lineHeight: 22 }}>There&apos;s no wrong answer — this helps us understand your rhythm, not judge it.</Text>
        </View>

        <SectionTitle>Your pattern</SectionTitle>
        <View style={{ marginTop: spacing.md, marginBottom: spacing.xxl, gap: spacing.md }}>
          {HABIT_OPTIONS.map((option) => (
            <TouchableOption
              key={option.id}
              selected={spendingHabit === option.id}
              onPress={() => setSpendingHabit(option.id)}
              accessibilityLabel={`Select ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: spendingHabit === option.id }}
            >
              <View style={[
                { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' },
                spendingHabit === option.id && { backgroundColor: `${colors.surface}33` },
              ]}>
                <option.icon size={18} color={spendingHabit === option.id ? colors.surface : colors.ink} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[
                  { ...typography.heading, color: colors.ink },
                  spendingHabit === option.id && { color: colors.surface },
                ]}>{option.label}</Text>
                <Text style={[
                  { ...typography.caption, fontSize: 12, color: colors.sage, marginTop: 2 },
                  spendingHabit === option.id && { color: `${colors.surface}CC` },
                ]}>{option.description}</Text>
              </View>
              {spendingHabit === option.id && (
                <View style={{ width: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 12, height: 12, borderWidth: 2, borderColor: colors.surface, borderLeftWidth: 0, borderTopWidth: 0, transform: [{ rotate: '45deg' }] }} />
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
          rightIcon={<ChevronLeft size={18} color={colors.surface} style={{ transform: [{ rotate: '180deg' }] }} />}
        >
          Continue
        </Button>
      </SafeScrollView>
    </ScreenContainer>
  );
}

function TouchableOption({ 
  children, 
  selected, 
  onPress, 
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
}: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.lg },
        selected && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
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