import React from 'react';
import { View, Text, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useOnboardingStore } from '@/services/onboarding-store';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { ChevronLeft, Building2, TrendingUp, Clock } from 'lucide-react-native';
import { IncomePattern, IncomeIntervalBand } from '@financial-hub/shared';

const INCOME_PATTERNS = [
  {
    id: 'salaried',
    label: 'Fixed salary, same day each month',
    description: 'Predictable — easy to plan around',
    icon: Building2,
  },
  {
    id: 'freelancer',
    label: 'Irregular freelance or business',
    description: 'Amounts and dates vary',
    icon: TrendingUp,
  },
  {
    id: 'mix',
    label: 'A mix of both',
    description: 'Base salary plus side income',
    icon: Clock,
  },
] as const;

const SOURCE_COUNTS = [
  { id: 1, label: '1 source' },
  { id: 2, label: '2–3 sources' },
  { id: 3, label: '4+ sources' },
] as const;

// Deliberately banded, not exact — most freelancers can't state "I get paid
// every 23 days," and asking for that precision just creates onboarding
// anxiety and bad data. See docs/FREELANCER_RUNWAY.md.
const INCOME_INTERVAL_BANDS: { id: IncomeIntervalBand; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'irregular', label: 'No clear pattern' },
];

export default function IncomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { setIncomeData, input } = useOnboardingStore();
  const { alert, modal } = useAlertModal();
  
  const [incomePattern, setIncomePattern] = React.useState<IncomePattern>('salaried');
  const [incomeAmount, setIncomeAmount] = React.useState('');
  const [sourceCount, setSourceCount] = React.useState(1);
  const [incomeIntervalBand, setIncomeIntervalBand] = React.useState<IncomeIntervalBand | null>(null);

  React.useEffect(() => {
    if (input.incomePattern) setIncomePattern(input.incomePattern);
    if (input.incomeAmount) setIncomeAmount(input.incomeAmount.toLocaleString());
    if (input.sourceCount) setSourceCount(input.sourceCount);
    if (input.incomeIntervalBand) setIncomeIntervalBand(input.incomeIntervalBand);
  }, [input]);

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, '');
    if (!cleaned) return '';
    return Number(cleaned).toLocaleString();
  };

  const handleAmountChange = (text: string) => {
    const formatted = formatAmount(text);
    setIncomeAmount(formatted);
  };

  const handleContinue = async () => {
    const amount = Number(incomeAmount.replace(/,/g, ''));
    
    if (!amount || amount <= 0) {
      alert('Error', 'Please enter your average monthly income');
      return;
    }

    if (incomePattern === 'freelancer' && !incomeIntervalBand) {
      alert('Error', 'Let us know roughly how often payments land');
      return;
    }

    setIncomeData({
      incomePattern: incomePattern as any,
      incomeAmount: amount,
      sourceCount,
      incomeIntervalBand: incomePattern === 'freelancer' ? incomeIntervalBand ?? undefined : undefined,
    });
    router.push('/(onboarding)/habits');
  };

  return (
    <ScreenContainer>
      <SafeScrollView>
        <BrandHeader />
        <ProgressIndicator currentStep={1} totalSteps={4} />

        <View style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.sage }}>Step 1 of 4 — Income</Text>
          <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm }}>How does your income usually arrive?</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, lineHeight: 22 }}>This shapes how your money gets split. There&apos;s no wrong answer — it just tunes the plan.</Text>
        </View>

        <SectionTitle>Income pattern</SectionTitle>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          {INCOME_PATTERNS.map((option) => (
            <TouchableOption
              key={option.id}
              selected={incomePattern === option.id}
              onPress={() => setIncomePattern(option.id)}
              accessibilityLabel={`Select ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: incomePattern === option.id }}
            >
              <View style={[
                { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' },
                incomePattern === option.id && { backgroundColor: `${colors.surface}33` },
              ]}>
                <option.icon size={18} color={incomePattern === option.id ? colors.surface : colors.ink} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[
                  { ...typography.heading, color: colors.ink },
                  incomePattern === option.id && { color: colors.surface },
                ]}>{option.label}</Text>
                <Text style={[
                  { ...typography.caption, fontSize: 12, color: colors.sage, marginTop: 2 },
                  incomePattern === option.id && { color: `${colors.surface}CC` },
                ]}>{option.description}</Text>
              </View>
              {incomePattern === option.id && (
                <View style={{ width: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 12, height: 12, borderWidth: 2, borderColor: colors.surface, borderLeftWidth: 0, borderTopWidth: 0, transform: [{ rotate: '45deg' }] }} />
                </View>
              )}
            </TouchableOption>
          ))}
        </View>

        {incomePattern === 'freelancer' && (
          <View style={{ marginTop: spacing.xl }}>
            <SectionTitle>Roughly how often do payments land?</SectionTitle>
            <Text style={{ ...typography.caption, fontSize: 12, color: colors.sage, marginTop: 4, marginBottom: spacing.md, lineHeight: 18 }}>
              Freelance income comes in bursts — that&apos;s normal, not a budgeting failure. A rough estimate is all we need; we&apos;ll refine it automatically as real payments come in.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {INCOME_INTERVAL_BANDS.map((band) => (
                <TouchableOpacity
                  key={band.id}
                  style={[
                    { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
                    incomeIntervalBand === band.id && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
                  ]}
                  onPress={() => setIncomeIntervalBand(band.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: incomeIntervalBand === band.id }}
                  accessibilityLabel={band.label}
                >
                  <Text style={[
                    { ...typography.caption, color: colors.ink, textAlign: 'center' },
                    incomeIntervalBand === band.id && { color: colors.surface },
                  ]}>{band.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Input
          label="Average monthly income (after tax)"
          value={incomeAmount}
          onChangeText={handleAmountChange}
          placeholder="68,000"
          keyboardType="numeric"
          textContentType="none"
          leftElement={<Text style={{ ...typography.body, fontSize: 15, color: colors.sage }}>KSh</Text>}
          accessible={true}
          accessibilityLabel="Average monthly income in Kenyan shillings"
        />

        <SectionTitle>Income sources</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xxl }}>
          {SOURCE_COUNTS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
                sourceCount === option.id && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
              ]}
              onPress={() => setSourceCount(option.id)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityState={{ selected: sourceCount === option.id }}
              accessibilityLabel={option.label}
            >
              <Text style={[
                { ...typography.caption, color: colors.ink, textAlign: 'center' },
                sourceCount === option.id && { color: colors.surface },
              ]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          fullWidth
          size="lg"
          onPress={handleContinue}
          rightIcon={<ChevronLeft size={18} color={colors.surface} style={{ transform: [{ rotate: '180deg' }] }} />}
        >
          Continue
        </Button>
      </SafeScrollView>
      {modal}
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
  ...props 
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
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
}