import React from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useOnboardingStore } from '@/services/onboarding-store';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { ChevronLeft, Building2, TrendingUp, Clock, User } from 'lucide-react-native';
import { IncomePattern, IncomeIntervalBand } from '@financial-hub/shared';
import type { Segment } from '@/services/onboarding-store';

const SEGMENT_OPTIONS: { id: Segment; label: string; description: string; icon: React.ComponentType<any> }[] = [
  { id: 'individual', label: 'Personal', description: 'For my own salary, rent, and daily spending', icon: User },
  { id: 'msme', label: 'Business', description: 'For my shop, stock, suppliers, and business bills', icon: Building2 },
];

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
  const { setIncomeData, setSegment, setMsmeData, input, segment, msmeInput } = useOnboardingStore();
  const { alert, modal } = useAlertModal();
  
  const [incomePattern, setIncomePattern] = React.useState<IncomePattern>('salaried');
  const [incomeAmount, setIncomeAmount] = React.useState('');
  const [sourceCount, setSourceCount] = React.useState(1);
  const [incomeIntervalBand, setIncomeIntervalBand] = React.useState<IncomeIntervalBand | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // MSME segment fields
  const [segmentChoice, setSegmentChoice] = React.useState<Segment>(segment);
  const [businessName, setBusinessName] = React.useState('');
  const [monthlyRevenue, setMonthlyRevenue] = React.useState('');
  const [hasEmployees, setHasEmployees] = React.useState(false);

  React.useEffect(() => {
    if (input.incomePattern) setIncomePattern(input.incomePattern);
    if (input.incomeAmount) setIncomeAmount(input.incomeAmount.toLocaleString());
    if (input.sourceCount) setSourceCount(input.sourceCount);
    if (input.incomeIntervalBand) setIncomeIntervalBand(input.incomeIntervalBand);
  }, [input]);

  React.useEffect(() => {
    if (msmeInput.businessName) setBusinessName(msmeInput.businessName);
    if (msmeInput.monthlyRevenue) setMonthlyRevenue(msmeInput.monthlyRevenue.toLocaleString());
    if (msmeInput.hasEmployees != null) setHasEmployees(msmeInput.hasEmployees);
  }, [msmeInput]);

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
    setIsLoading(true);
    try {
      if (segmentChoice === 'msme') {
        const amount = Number(monthlyRevenue.replace(/,/g, ''));
        if (!businessName.trim()) {
          alert('Error', 'Please enter your business name');
          setIsLoading(false);
          return;
        }
        if (!amount || amount <= 0) {
          alert('Error', 'Please enter your average monthly revenue');
          setIsLoading(false);
          return;
        }
        setSegment('msme');
        setMsmeData({
          businessName: businessName.trim(),
          monthlyRevenue: amount,
          hasEmployees,
        });
        router.push('/(onboarding)/msme-fixed');
        return;
      }

      const amount = Number(incomeAmount.replace(/,/g, ''));

      if (!amount || amount <= 0) {
        alert('Error', 'Please enter your average monthly income');
        setIsLoading(false);
        return;
      }

      if (incomePattern === 'freelancer' && !incomeIntervalBand) {
        alert('Error', 'Let us know roughly how often payments land');
        setIsLoading(false);
        return;
      }

      setSegment('individual');
      setIncomeData({
        incomePattern: incomePattern as any,
        incomeAmount: amount,
        sourceCount,
        incomeIntervalBand: incomePattern === 'freelancer' ? incomeIntervalBand ?? undefined : undefined,
      });
      router.push('/(onboarding)/habits');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      await alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <SafeScrollView>
        <BrandHeader onBack={() => {}} fallbackHref="/" />
        <ProgressIndicator currentStep={1} totalSteps={6} />

        <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.sage }}>Step 1 of 6 — Who is this for?</Text>
          <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm }}>What should this plan run?</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, lineHeight: 22 }}>Personal plans split your salary into living costs. Business plans run a money plan for your shop or business with its own pockets.</Text>
        </View>

        <View style={{ gap: spacing.md }}>
          {SEGMENT_OPTIONS.map((option) => {
            const selected = segmentChoice === option.id;
            return (
              <TouchableOption
                key={option.id}
                selected={selected}
                onPress={() => setSegmentChoice(option.id)}
                accessibilityLabel={`Select ${option.label} plan`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={[
                  { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' },
                  selected && { backgroundColor: `${colors.surface}33` },
                ]}>
                  <option.icon size={18} color={selected ? colors.surface : colors.ink} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[
                    { ...typography.heading, color: colors.ink },
                    selected && { color: colors.surface },
                  ]}>{option.label}</Text>
                  <Text style={[
                    { ...typography.caption, fontSize: 12, color: colors.sage, marginTop: 2 },
                    selected && { color: `${colors.surface}CC` },
                  ]}>{option.description}</Text>
                </View>
                {selected && (
                  <View style={{ width: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 12, height: 12, borderWidth: 2, borderColor: colors.surface, borderLeftWidth: 0, borderTopWidth: 0, transform: [{ rotate: '45deg' }] }} />
                  </View>
                )}
              </TouchableOption>
            );
          })}
        </View>

        {segmentChoice === 'msme' ? (
          <>
            <View style={{ marginTop: spacing.xl }}>
              <Input
                label="Business name"
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="e.g. Duka Kool"
                textContentType="none"
                accessible={true}
                accessibilityLabel="Business name"
              />
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <Input
                label="Average monthly revenue"
                value={monthlyRevenue}
                onChangeText={(text) => setMonthlyRevenue(formatAmount(text))}
                placeholder="50,000"
                keyboardType="numeric"
                textContentType="none"
                leftElement={<Text style={{ ...typography.body, fontSize: 15, color: colors.sage }}>KSh</Text>}
                accessible={true}
                accessibilityLabel="Average monthly revenue in Kenyan shillings"
              />
            </View>

            <SectionTitle>Does the business have employees?</SectionTitle>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              {[{ id: true, label: 'Yes' }, { id: false, label: 'No, just me' }].map((option) => (
                <Pressable
                  key={String(option.id)}
                  style={({ pressed }) => [
                    { flex: 1, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', minHeight: touchTarget.minHeight },
                    hasEmployees === option.id && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => setHasEmployees(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: hasEmployees === option.id }}
                  accessibilityLabel={option.label}
                >
                  <Text style={[
                    { ...typography.caption, color: colors.ink },
                    hasEmployees === option.id && { color: colors.surface },
                  ]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

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
          </>
        ) : (
          <>
            <SectionTitle>Income pattern</SectionTitle>
        <View style={{ marginTop: spacing.md, marginBottom: spacing.xl, gap: spacing.md }}>
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
                <Pressable
                  key={band.id}
                  style={({ pressed }) => [
                    { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
                    incomeIntervalBand === band.id && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
                    { opacity: pressed ? 0.7 : 1 },
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
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <Input
            label="Average monthly income (after tax)"
            value={incomeAmount}
            onChangeText={handleAmountChange}
            placeholder="50,000"
            keyboardType="numeric"
            textContentType="none"
            leftElement={<Text style={{ ...typography.body, fontSize: 15, color: colors.sage }}>KSh</Text>}
            accessible={true}
            accessibilityLabel="Average monthly income in Kenyan shillings"
          />
        </View>

        <SectionTitle>Income sources</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xl }}>
          {SOURCE_COUNTS.map((option) => (
            <Pressable
              key={option.id}
              style={({ pressed }) => [
                { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
                sourceCount === option.id && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
                { opacity: pressed ? 0.7 : 1 },
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
            </Pressable>
          ))}
        </View>

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
          </>
        )}
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
    <Pressable
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.lg },
        selected && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
        { minHeight: touchTarget.minHeight * 2 },
        { opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      {...props}
    >
      {children}
    </Pressable>
  );
}