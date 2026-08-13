import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, touchTarget } from '@/theme';
import { useOnboardingStore } from '@/services/onboarding-store';
import { Button, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft, GraduationCap, Briefcase, Wrench, Users, PiggyBank, Sparkles, Bus } from 'lucide-react-native';
import type { EmergencyBuffer, LifeStage, MoneyPersonality } from '@financial-hub/shared';

const LIFE_STAGES: { id: LifeStage; label: string; description: string; icon: typeof GraduationCap }[] = [
  { id: 'student', label: 'Student', description: 'Allowance or part-time income', icon: GraduationCap },
  { id: 'working_adult', label: 'Working adult', description: 'Job or salaried work', icon: Briefcase },
  { id: 'self_employed', label: 'Self-employed', description: 'Business, gig, or freelance', icon: Wrench },
];

const DEPENDENT_OPTIONS: { id: boolean; label: string; description: string }[] = [
  { id: true, label: 'Yes — I support others', description: 'School fees, family upkeep, dependents' },
  { id: false, label: 'No — just myself', description: 'Money is mainly for your own needs' },
];

const TRANSPORT_OPTIONS: { id: boolean; label: string; description: string }[] = [
  { id: true, label: 'Yes — I spend on it regularly', description: 'Commuting, fares, fuel, or similar' },
  { id: false, label: 'No — rarely or never', description: 'e.g. you work remote or walk everywhere' },
];

const BUFFER_OPTIONS: { id: EmergencyBuffer; label: string; description: string }[] = [
  { id: 'none', label: 'Nothing set aside', description: 'Would struggle if income stopped' },
  { id: 'under_month', label: 'Less than a month', description: 'A small cushion only' },
  { id: '1_to_3_months', label: '1–3 months', description: 'A workable emergency buffer' },
  { id: '3_plus_months', label: '3+ months', description: 'A stronger safety net' },
];

const PERSONALITY_OPTIONS: { id: MoneyPersonality; label: string; description: string }[] = [
  { id: 'spender', label: 'I treat myself or spend it', description: 'Unexpected money gets used soon' },
  { id: 'saver', label: 'I put it aside', description: 'I park it before I decide' },
  { id: 'avoider', label: 'I leave it alone for a while', description: 'I often delay deciding what to do' },
];

export default function AboutYouScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { setAboutYouData, input } = useOnboardingStore();

  const [lifeStage, setLifeStage] = React.useState<LifeStage>(input.lifeStage ?? 'working_adult');
  const [hasDependents, setHasDependents] = React.useState<boolean>(input.hasDependents ?? false);
  const [emergencyBuffer, setEmergencyBuffer] = React.useState<EmergencyBuffer>(
    input.emergencyBuffer ?? 'under_month',
  );
  const [moneyPersonality, setMoneyPersonality] = React.useState<MoneyPersonality>(
    input.moneyPersonality ?? 'saver',
  );
  const [hasTransportNeed, setHasTransportNeed] = React.useState<boolean>(
    input.hasTransportNeed ?? true,
  );
  const [isLoading, setIsLoading] = React.useState(false);

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      setAboutYouData({ lifeStage, hasDependents, emergencyBuffer, moneyPersonality, hasTransportNeed });
      router.push('/(onboarding)/goal');
    } catch (error) {
      console.error('Error saving about you data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <SafeScrollView>
        <BrandHeader onBack={() => router.back()} />
        <ProgressIndicator currentStep={3} totalSteps={6} />

        <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.sage }}>Step 3 of 6 — About you</Text>
          <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm }}>
            A few details so the plan fits your life
          </Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, lineHeight: 22 }}>
            These answers shape pockets and how firm the guardrails feel — not a judgment of how you handle money.
          </Text>
        </View>

        <SectionTitle>Life stage</SectionTitle>
        <View style={{ marginTop: spacing.md, marginBottom: spacing.xl, gap: spacing.md }}>
          {LIFE_STAGES.map((option) => (
            <ChoiceRow
              key={option.id}
              selected={lifeStage === option.id}
              onPress={() => setLifeStage(option.id)}
              label={option.label}
              description={option.description}
              icon={option.icon}
            />
          ))}
        </View>

        <SectionTitle>Household</SectionTitle>
        <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, marginBottom: spacing.md }}>
          Do you regularly send or spend money for others?
        </Text>
        <View style={{ marginBottom: spacing.xl, gap: spacing.md }}>
          {DEPENDENT_OPTIONS.map((option) => (
            <ChoiceRow
              key={String(option.id)}
              selected={hasDependents === option.id}
              onPress={() => setHasDependents(option.id)}
              label={option.label}
              description={option.description}
              icon={Users}
            />
          ))}
        </View>

        <SectionTitle>Transport</SectionTitle>
        <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, marginBottom: spacing.md }}>
          Do you regularly spend on transport or commuting?
        </Text>
        <View style={{ marginBottom: spacing.xl, gap: spacing.md }}>
          {TRANSPORT_OPTIONS.map((option) => (
            <ChoiceRow
              key={String(option.id)}
              selected={hasTransportNeed === option.id}
              onPress={() => setHasTransportNeed(option.id)}
              label={option.label}
              description={option.description}
              icon={Bus}
            />
          ))}
        </View>

        <SectionTitle>Emergency buffer</SectionTitle>
        <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, marginBottom: spacing.md }}>
          If income stopped, how long could you live on what you already have set aside?
        </Text>
        <View style={{ marginBottom: spacing.xl, gap: spacing.md }}>
          {BUFFER_OPTIONS.map((option) => (
            <ChoiceRow
              key={option.id}
              selected={emergencyBuffer === option.id}
              onPress={() => setEmergencyBuffer(option.id)}
              label={option.label}
              description={option.description}
              icon={PiggyBank}
            />
          ))}
        </View>

        <SectionTitle>When you get unexpected money</SectionTitle>
        <View style={{ marginTop: spacing.md, marginBottom: spacing.xxl, gap: spacing.md }}>
          {PERSONALITY_OPTIONS.map((option) => (
            <ChoiceRow
              key={option.id}
              selected={moneyPersonality === option.id}
              onPress={() => setMoneyPersonality(option.id)}
              label={option.label}
              description={option.description}
              icon={Sparkles}
            />
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
  icon: typeof Users;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
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
      ]}
    >
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
    </TouchableOpacity>
  );
}