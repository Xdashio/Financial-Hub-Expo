import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, touchTarget } from '@/theme';
import { useOnboardingStore } from '@/services/onboarding-store';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft, Shield, ShoppingBag, GraduationCap, Sparkles } from 'lucide-react-native';
import type { SavingsGoalType, SavingsGoalTimeframe } from '@financial-hub/shared';

const GOAL_TYPES: { id: SavingsGoalType; label: string; description: string; icon: typeof Shield }[] = [
  { id: 'emergency_fund', label: 'Emergency fund', description: 'A cushion for the unexpected', icon: Shield },
  { id: 'purchase', label: 'Something specific', description: 'A purchase or event you\u2019re planning for', icon: ShoppingBag },
  { id: 'dependent_education', label: 'Education', description: 'School fees for yourself or a dependent', icon: GraduationCap },
  { id: 'other', label: 'Something else', description: 'Any other goal', icon: Sparkles },
];

const TIMEFRAMES: { id: SavingsGoalTimeframe; label: string }[] = [
  { id: '3_months', label: '~3 months' },
  { id: '6_months', label: '~6 months' },
  { id: '1_year', label: '~1 year' },
  { id: '2_plus_years', label: '2+ years' },
];

export default function GoalScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { setSavingsGoalData, input } = useOnboardingStore();

  const existingGoal = input.savingsGoal;
  const [hasGoal, setHasGoal] = React.useState<boolean>(!!existingGoal);
  const [goalType, setGoalType] = React.useState<SavingsGoalType>(existingGoal?.goalType ?? 'emergency_fund');
  const [goalLabel, setGoalLabel] = React.useState<string>(existingGoal?.goalLabel ?? '');
  const [goalAmount, setGoalAmount] = React.useState<string>(
    existingGoal?.goalAmount ? existingGoal.goalAmount.toLocaleString() : '',
  );
  const [goalTimeframe, setGoalTimeframe] = React.useState<SavingsGoalTimeframe>(
    existingGoal?.goalTimeframe ?? '1_year',
  );
  const [isLoading, setIsLoading] = React.useState(false);

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, '');
    if (!cleaned) return '';
    return Number(cleaned).toLocaleString();
  };

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      if (!hasGoal) {
        // Skipped entirely — rules engine falls back to the buffer-based
        // rate with no shortfall messaging.
        setSavingsGoalData(undefined);
      } else {
        const amount = Number(goalAmount.replace(/,/g, ''));
        setSavingsGoalData({
          goalType,
          goalLabel: goalLabel.trim() ? goalLabel.trim() : undefined,
          goalAmount: amount > 0 ? amount : undefined,
          goalTimeframe,
        });
      }
      router.push('/(onboarding)/fixed');
    } catch (error) {
      console.error('Error saving savings goal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <SafeScrollView>
        <BrandHeader onBack={() => {}} fallbackHref="/(onboarding)/about-you" />
        <ProgressIndicator currentStep={4} totalSteps={6} />

        <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.sage }}>Step 4 of 6 — Savings goal</Text>
          <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm }}>
            Saving toward something?
          </Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, lineHeight: 22 }}>
            Optional — if you tell us what and roughly when, we'll shape your savings rate around it instead of a flat default. Skip if you'd rather not.
          </Text>
        </View>

        <View style={{ marginBottom: spacing.xl, gap: spacing.md }}>
          <ChoiceRow
            selected={hasGoal}
            onPress={() => setHasGoal(true)}
            label="Yes — I have a goal in mind"
            description="Set what, roughly how much, and by when"
          />
          <ChoiceRow
            selected={!hasGoal}
            onPress={() => setHasGoal(false)}
            label="No — skip this for now"
            description="We'll use a sensible default savings rate instead"
          />
        </View>

        {hasGoal && (
          <>
            <SectionTitle>What's it for</SectionTitle>
            <View style={{ marginTop: spacing.md, marginBottom: spacing.xl, gap: spacing.md }}>
              {GOAL_TYPES.map((option) => (
                <ChoiceRow
                  key={option.id}
                  selected={goalType === option.id}
                  onPress={() => setGoalType(option.id)}
                  label={option.label}
                  description={option.description}
                  icon={option.icon}
                />
              ))}
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <Input
                label="Give it a name (optional)"
                value={goalLabel}
                onChangeText={setGoalLabel}
                placeholder="e.g. Amara's school fees"
                maxLength={60}
                accessible={true}
                accessibilityLabel="Optional name for your savings goal"
              />
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <Input
                label="Roughly how much? (optional)"
                value={goalAmount}
                onChangeText={(text) => setGoalAmount(formatAmount(text))}
                placeholder="e.g. 100,000"
                keyboardType="numeric"
                textContentType="none"
                leftElement={<Text style={{ ...typography.body, fontSize: 15, color: colors.sage }}>KSh</Text>}
                accessible={true}
                accessibilityLabel="Roughly how much you want to save, in Kenyan shillings"
              />
              <Text style={{ ...typography.caption, fontSize: 12, color: colors.sage, marginTop: spacing.xs }}>
                Leave this blank if you're not sure yet — we'll still use your timeframe to set a sensible lock length.
              </Text>
            </View>

            <SectionTitle>Roughly by when</SectionTitle>
            <View style={{ marginTop: spacing.md, marginBottom: spacing.xl, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {TIMEFRAMES.map((option) => (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.sm + 2,
                      borderRadius: radius.pill,
                      borderWidth: 1.5,
                      borderColor: colors.line,
                      backgroundColor: colors.surface,
                      minWidth: 88,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    goalTimeframe === option.id && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => setGoalTimeframe(option.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: goalTimeframe === option.id }}
                  accessibilityLabel={option.label}
                >
                  <Text
                    style={[
                      { ...typography.caption, color: colors.ink, textAlign: 'center' },
                      goalTimeframe === option.id && { color: colors.surface },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <Button
            fullWidth
            size="lg"
            loading={isLoading}
            onPress={handleContinue}
            rightIcon={<ChevronLeft size={18} color={colors.surface} style={{ transform: [{ rotate: '180deg' }] }} />}
          >
            Continue
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}

function ChoiceRow({
  selected,
  onPress,
  label,
  description,
  icon: Icon,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  description: string;
  icon?: typeof Shield;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surface,
          minHeight: touchTarget.minHeight,
        },
        selected && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {Icon && (
        <View
          style={[
            {
              width: 44,
              height: 44,
              borderRadius: radius.md,
              backgroundColor: colors.emeraldTint,
              alignItems: 'center',
              justifyContent: 'center',
            },
            selected && { backgroundColor: `${colors.surface}33` },
          ]}
        >
          <Icon size={18} color={selected ? colors.surface : colors.ink} strokeWidth={2} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[{ ...typography.heading, color: colors.ink }, selected && { color: colors.surface }]}>
          {label}
        </Text>
        <Text
          style={[
            { ...typography.caption, fontSize: 12, color: colors.sage, marginTop: 2 },
            selected && { color: `${colors.surface}CC` },
          ]}
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );
}