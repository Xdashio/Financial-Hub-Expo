import React from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useOnboardingStore } from '@/services/onboarding-store';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft, Building2, TrendingUp, Clock } from 'lucide-react-native';
import { IncomePattern } from '@financial-hub/shared';

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

export default function IncomeScreen() {
  const router = useRouter();
  const { setIncomeData, previewPlan, input } = useOnboardingStore();
  
  const [incomePattern, setIncomePattern] = React.useState<IncomePattern>('salaried');
  const [incomeAmount, setIncomeAmount] = React.useState('');
  const [sourceCount, setSourceCount] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (input.incomePattern) setIncomePattern(input.incomePattern);
    if (input.incomeAmount) setIncomeAmount(input.incomeAmount.toLocaleString());
    if (input.sourceCount) setSourceCount(input.sourceCount);
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
      Alert.alert('Error', 'Please enter your average monthly income');
      return;
    }

    setIsLoading(true);
    try {
      setIncomeData({
        incomePattern: incomePattern as any,
        incomeAmount: amount,
        sourceCount,
      });
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
        <BrandHeader onBack={() => router.canGoBack() && router.back()} />
        <ProgressIndicator currentStep={1} totalSteps={4} />

        <View style={styles.header}>
          <Text style={styles.eyebrow}>Step 1 of 4 — Income</Text>
          <Text style={styles.title}>How does your income usually arrive?</Text>
          <Text style={styles.subtext}>This shapes how your money gets split. There&apos;s no wrong answer — it just tunes the plan.</Text>
        </View>

        <SectionTitle>Income pattern</SectionTitle>
        <View style={styles.options}>
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
                styles.optionIcon,
                incomePattern === option.id && styles.optionIconSelected,
              ]}>
                <option.icon size={18} color={incomePattern === option.id ? '#fff' : colors.ink} strokeWidth={2} />
              </View>
              <View style={styles.optionText}>
                <Text style={[
                  styles.optionTitle,
                  incomePattern === option.id && styles.optionTitleSelected,
                ]}>{option.label}</Text>
                <Text style={[
                  styles.optionDesc,
                  incomePattern === option.id && styles.optionDescSelected,
                ]}>{option.description}</Text>
              </View>
              {incomePattern === option.id && (
                <View style={styles.optionCheck}>
                  <View style={styles.checkMark} />
                </View>
              )}
            </TouchableOption>
          ))}
        </View>

        <Input
          label="Average monthly income (after tax)"
          value={incomeAmount}
          onChangeText={handleAmountChange}
          placeholder="68,000"
          keyboardType="numeric"
          textContentType="none"
          leftElement={<Text style={styles.currencyPrefix}>KSh</Text>}
          accessible={true}
          accessibilityLabel="Average monthly income in Kenyan shillings"
        />

        <SectionTitle>Income sources</SectionTitle>
        <View style={styles.chipRow}>
          {SOURCE_COUNTS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.chip,
                sourceCount === option.id && styles.chipSelected,
              ]}
              onPress={() => setSourceCount(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: sourceCount === option.id }}
              accessibilityLabel={option.label}
            >
              <Text style={[
                styles.chipText,
                sourceCount === option.id && styles.chipTextSelected,
              ]}>{option.label}</Text>
            </TouchableOpacity>
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

function TouchableOption({ 
  children, 
  selected, 
  onPress, 
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  ...props 
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
      {...props}
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
  optionIconSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
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
  currencyPrefix: {
    ...typography.body,
    fontSize: 15,
    color: colors.sage,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    minHeight: touchTarget.minHeight,
  },
  chipSelected: {
    borderColor: colors.emeraldDeep,
    backgroundColor: colors.emeraldDeep,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.ink,
  },
  chipTextSelected: {
    color: '#fff',
  },
});