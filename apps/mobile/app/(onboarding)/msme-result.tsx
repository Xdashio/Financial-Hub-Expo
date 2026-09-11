import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography } from '@/theme';
import { useOnboardingStore, BUSINESS_CATEGORIES } from '@/services/onboarding-store';
import { useAuthStore } from '@/services/auth';
import { useAlertModal } from '@/hooks/useAlertModal';
import { Button, ScreenContainer, BrandHeader } from '@/components/ui';
import { ChevronLeft, Check, Lock, TrendingUp } from 'lucide-react-native';
import { formatMoney } from '@/utils/money';
import { getCategoryIcon } from '@/utils/categoryIcons';

export default function MsmeResultScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { alert, modal } = useAlertModal();
  const { assignResult, msmeInput, msmeCustomPockets, fixedExpenses, commitMsmePlan, reset } = useOnboardingStore();

  const [isCommitting, setIsCommitting] = React.useState(false);

  React.useEffect(() => {
    if (!assignResult) {
      router.replace('/(onboarding)/msme-fixed');
    }
  }, [assignResult, router]);

  if (!assignResult) {
    return null;
  }

  const businessName = msmeInput.businessName || 'your business';
  const fixedTotal = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const { savingsTarget, spendableAmount } = assignResult;

  const hasPercentages = msmeCustomPockets.some((p) => p.percentage != null && p.percentage > 0);

  const pocketRows = [
    { name: 'Fixed costs', category: 'rent' as const, amount: fixedTotal, type: 'fixed' as const, percentage: null },
    { name: 'Savings', category: 'emergency' as const, amount: savingsTarget, type: 'savings' as const, percentage: 10 },
    ...msmeCustomPockets.length > 0
      ? msmeCustomPockets.map((p) => ({
          name: p.name,
          category: p.category,
          percentage: p.percentage ?? null,
          amount: hasPercentages && p.percentage != null
            ? Math.round(spendableAmount * (p.percentage / 100) * 100) / 100
            : Math.round(spendableAmount / msmeCustomPockets.length * 100) / 100,
          type: 'spendable' as const,
        }))
      : [{ name: 'Business spending', category: 'operations' as const, amount: spendableAmount, type: 'spendable' as const, percentage: 100 }],
  ];

  const handleEnterPlan = async () => {
    setIsCommitting(true);
    try {
      await commitMsmePlan();
      useAuthStore.setState({ hasPlan: true, isCheckingPlan: false });
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      router.replace('/(msme)');
      setTimeout(() => reset(), 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create your business plan. Please try again.';
      await alert('Error', message);
      useAuthStore.setState({ hasPlan: false, isCheckingPlan: false });
    } finally {
      setIsCommitting(false);
    }
  };

  const getPocketColor = (type: string) => {
    if (type === 'fixed') return colors.gold;
    if (type === 'savings') return colors.emeraldDeep;
    return colors.plum;
  };

  const money = (amount: number) => formatMoney(amount);

  return (
    <ScreenContainer>
      <BrandHeader onBack={() => {}} fallbackHref="/(onboarding)/msme-fixed" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
            <Check size={26} color={colors.surface} strokeWidth={1.7} />
          </View>
          <Text style={{ ...typography.eyebrow, color: colors.sage }}>Your business money plan is ready</Text>
          <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm, textAlign: 'center' }}>{businessName}</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.xs, textAlign: 'center' }}>{assignResult.plan} · Monthly revenue split</Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <View>
            <Text style={{ ...typography.caption, color: colors.sage }}>Monthly revenue</Text>
            <Text style={{ ...typography.title, color: colors.emeraldDeep, marginTop: 2 }}>{money(assignResult.remainingAfterFixed + fixedTotal)}</Text>
          </View>
          <TrendingUp size={22} color={colors.emeraldDeep} strokeWidth={2} />
        </View>

        {pocketRows.map((pocket) => {
          const color = getPocketColor(pocket.type);
          const Icon = getCategoryIcon(pocket.category);
          return (
            <View key={`${pocket.type}-${pocket.name}`} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
              <View style={{ borderTopWidth: 1.5, borderTopColor: color, borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
              <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: color }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                  <Icon size={16} color={colors.ink} strokeWidth={2} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={{ ...typography.heading, color: colors.ink }} numberOfLines={1}>{pocket.name}</Text>
                      {pocket.type === 'savings' && <Lock size={13} color={colors.sage} strokeWidth={2} />}
                    </View>
                    {pocket.percentage != null && (
                      <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 1 }}>
                        {pocket.type === 'savings' ? '10% revenue floor' : `${pocket.percentage}% of spendable pool`}
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>{money(pocket.amount)}</Text>
              </View>
              <View style={{ height: 6, backgroundColor: colors.lineSoft, borderRadius: radius.pill, marginTop: spacing.md, overflow: 'hidden' }}>
                <View style={{ height: '100%', borderRadius: radius.pill, backgroundColor: color, width: '100%' }} />
              </View>
            </View>
          );
        })}

        <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl }}>
          Savings minimum 10% of revenue — enforced
        </Text>

        <Button fullWidth size="lg" loading={isCommitting} onPress={handleEnterPlan} rightIcon={<ChevronLeft size={18} color={colors.surface} style={{ transform: [{ rotate: '180deg' }] }} />}>
          Create my business plan
        </Button>
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}