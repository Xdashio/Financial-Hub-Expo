import React from 'react';
import { View, Text, Image, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { radius, spacing, typography, shadow, touchTarget, categoryColors } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import {
  Shield, RefreshCw, Lock,
  ArrowLeftRight, Plus,
  Calendar, TrendingUp, Bell, ShoppingCart, AlertTriangle, PiggyBank, ChevronDown, ChevronUp, MoreHorizontal,
} from 'lucide-react-native';
import { useHomeStore } from '@/services/home-store';
import { useDataSync } from '@/services/data-sync';
import { loansApi, emergencyUnlockApi } from '@/services/api';
import { ScreenContainer, LoadingState, ErrorState, PocketGlyph, ActionsSheet } from '@/components/ui';
import { CategoryIcon } from '@/components/icons';
import { NudgesSheet } from '@/components/home/NudgesSheet';
import { EmergencyUnlockSheet } from '@/components/home/EmergencyUnlockSheet';
import { useAlertModal } from '@/hooks/useAlertModal';
import { deriveNudges } from '@/services/nudges';
import { formatMoney } from '@/utils/money';
import { pocketGlyphKind } from '@/utils/pocketGlyph';
import { getEnhancedErrorMessage } from '@/utils/errorMessages';
import { useOnboardingStore } from '@/services/onboarding-store';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert, modal } = useAlertModal();
  const {
    pockets,
    dailyPockets,
    planType,
    rolloverAmount,
    safeToSpendToday,
    totalBalance,
    disciplineScore,
    scoreDelta,
    currentStreak,
    cardOrder,
    runway,
    isLoading,
    error,
    fetchHomeData,
    refreshData,
  } = useHomeStore();

  const [nudgesVisible, setNudgesVisible] = React.useState(false);
  const [emergencyUnlockVisible, setEmergencyUnlockVisible] = React.useState(false);
  const [actionsVisible, setActionsVisible] = React.useState(false);
  const [isUnlocking, setIsUnlocking] = React.useState(false);
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    spendable: false,
    fixed: false,
    savings: false,
  });

  // Check if all non-savings pockets are depleted for emergency unlock
  const showEmergencyUnlock = React.useMemo(() => {
    const nonSavingsPockets = pockets.filter(p => p.kind !== 'savings');
    const allDepleted = nonSavingsPockets.length > 0 && nonSavingsPockets.every(p => p.availableBalance <= 0);
    const hasSavings = pockets.some(p => p.kind === 'savings' && p.availableBalance > 0);
    return allDepleted && hasSavings;
  }, [pockets]);

  const handleEmergencyUnlock = async (amount: number) => {
    setIsUnlocking(true);
    try {
      const response = await emergencyUnlockApi.executeUnlock({ amount, confirm_impact: true });
      if (response.applied && response.unlock) {
        setEmergencyUnlockVisible(false);
        await refreshData();
        await alert(
          'Emergency allocation complete',
          `${formatMoney(response.unlock.amount)} was allocated. Your runway changed from ${response.unlock.runway_days_before} to ${response.unlock.runway_days_after} days (${response.unlock.runway_reduction_days} day${response.unlock.runway_reduction_days !== 1 ? 's' : ''} reduction).`
        );
      } else {
        await alert('Emergency allocation failed', response.message ?? "Couldn't complete the allocation. Please try again.");
      }
    } catch (error: any) {
      console.error('Emergency allocation failed:', error);
      await alert('Emergency allocation failed', error?.message ?? "Couldn't complete the allocation. Please try again.");
    } finally {
      setIsUnlocking(false);
    }
  };

  // Derived client-side from data Home already fetches — see
  // src/services/nudges.ts for why this doesn't hit a separate endpoint.
  const nudges = React.useMemo(
    () => deriveNudges({ pockets, dailyPockets, planType, disciplineScore, scoreDelta, currentStreak, runway, rolloverAmount }),
    [pockets, dailyPockets, planType, disciplineScore, scoreDelta, currentStreak, runway, rolloverAmount]
  );
  const hasUrgentNudge = nudges.some(n => n.severity === 'alert');

  React.useEffect(() => {
    fetchHomeData();
  }, []);

  // Home stays mounted across tab switches (Expo Router tabs don't unmount),
  // so without this, balances go stale after logging a spend, income, or
  // reallocation on another screen and navigating back — the ledger updates
  // server-side immediately, but this screen keeps showing pre-change
  // numbers until the app is fully reloaded. Mirrors the same pattern
  // already used on the pocket detail screen.
  const isFirstFocus = React.useRef(true);
  useFocusEffect(
    React.useCallback(() => {
      if (isFirstFocus.current) { isFirstFocus.current = false; return; }
      refreshData();
    }, [refreshData])
  );

  // Defense-in-depth against the focus-effect above: several money-moving
  // flows (reallocation, income) call useDataSync's bump() the instant
  // their request succeeds, before any navigation/focus event fires — so
  // this refetches even if a screen transition skips past Home without a
  // focus event (see src/services/data-sync.ts for why that can happen).
  const dataVersion = useDataSync(s => s.version);
  const isFirstVersion = React.useRef(true);
  React.useEffect(() => {
    if (isFirstVersion.current) { isFirstVersion.current = false; return; }
    refreshData();
  }, [dataVersion, refreshData]);

  const formatCurrency = (amount: number) => formatMoney(amount);

  const getPocketColor = (kind: string, category?: string) => {
    if (kind === 'fixed') return colors.gold;
    if (kind === 'savings') return colors.emeraldDeep;
    if (kind === 'spendable') {
      // Use category-specific colors from theme
      if (category && categoryColors[category]) {
        return categoryColors[category];
      }
      // Fallback to existing color logic
      switch (category) {
        case 'food': return colors.emerald;
        case 'transport': return colors.plum;
        case 'leisure': return colors.clay;
        default: return colors.emerald;
      }
    }
    return colors.emerald;
  };

  const getPocketPurpose = (pocket: any) => {
    if (pocket.kind === 'fixed') return 'Fixed costs';
    if (pocket.kind === 'savings') return 'Savings';
    return 'Spendable';
  };

  const getPocketStatus = (pocket: any) => {
    if (pocket.isTimeLocked) return 'Locked';
    // A pocket at exactly 0 has simply never been funded / is fully spent
    // within budget — "Awaiting income" fits. A pocket that's gone negative
    // (via the insufficient-funds "spend anyway" override) is a distinct,
    // more urgent state and should not be mislabeled the same way.
    if (pocket.availableBalance < 0) return 'Overspent';
    if (pocket.availableBalance === 0) return 'Awaiting income';
    if (pocket.kind === 'savings') return 'Protected';
    if (pocket.kind === 'fixed') return 'Funded';
    return 'Available';
  };

  if (isLoading && pockets.length === 0) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading your financial hub..." variant="home" />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={refreshData} />
      </ScreenContainer>
    );
  }

  if (pockets.length === 0) {
    return (
      <ScreenContainer>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
            <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
              <PiggyBank size={32} color={colors.gold} strokeWidth={2} />
            </View>
            <Text style={{ ...typography.title, color: colors.ink }}>Start your money plan</Text>
            <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, textAlign: 'center', lineHeight: 21 }}>
              Complete onboarding to create your personalized pockets for savings, fixed costs, and daily spending.
            </Text>
            <Pressable
              style={({ pressed }) => [{
                marginTop: spacing.lg,
                backgroundColor: colors.emeraldDeep,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xl,
              }, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => {
                useOnboardingStore.getState().setSegment('individual');
                router.push('/(onboarding)/income');
              }}
              accessibilityLabel="Start onboarding"
              accessibilityRole="button"
            >
              <Text style={{ ...typography.heading, color: colors.surface, textAlign: 'center' }}>
                Start Onboarding
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  const fixedPockets = pockets.filter(p => p.kind === 'fixed');
  const savingsPockets = pockets.filter(p => p.kind === 'savings');
  // In the structured plan, spendable pockets don't have a daily cap — they're
  // shown as monthly-allocation cards alongside fixed & savings pockets
  // instead of the daily budget strip.
  const structuredSpendablePockets = pockets.filter(p => p.kind === 'spendable');
  const isDaily = planType === 'daily';
  // Personality cardOrder (from discipline-score API): savers/avoiders lead
  // with discipline → surface Savings earlier; spenders keep spendable first.
  const prioritizeSavings = cardOrder[0] === 'discipline_score';
  const pocketSectionOrder = (prioritizeSavings
    ? (['savings', 'spendable', 'fixed'] as const)
    : (['spendable', 'fixed', 'savings'] as const));

  const renderPocketCard = (pocket: typeof pockets[number]) => {
    const pocketColor = getPocketColor(pocket.kind, pocket.category);
    const purpose = getPocketPurpose(pocket);
    const status = getPocketStatus(pocket);
    const pocketProgress = pocket.monthlyAllocation > 0
      ? Math.max(0, Math.min(1, pocket.availableBalance / pocket.monthlyAllocation))
      : 0;
    return (
      <Pressable
        key={pocket.id}
        style={({ pressed }) => [{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.lg, marginBottom: spacing.md, ...shadow.default }, { opacity: pressed ? 0.8 : 1 }]}
        onPress={() => {
          if (pocket.kind === 'loan') {
            router.push({ pathname: '/(loans)/detail', params: { id: pocket.id } });
          } else {
            router.push(`/(pockets)/detail?id=${pocket.id}`);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={`${pocket.name} pocket, ${purpose}, ${formatCurrency(pocket.availableBalance)} available, ${status}`}
      >
        <View style={{ borderTopWidth: 1.5, borderTopColor: pocketColor, borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
        <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: pocketColor }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, paddingRight: spacing.sm }}>
            {pocket.category ? (
              <CategoryIcon category={pocket.category} size={16} />
            ) : pocket.kind === 'savings' ? (
              <CategoryIcon category="emergency" size={16} />
            ) : (
              <PocketGlyph kind={pocketGlyphKind(pocket.kind)} color={pocketColor} size={16} muted />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }} numberOfLines={1}>{pocket.name}</Text>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 2 }} numberOfLines={1}>{purpose}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {pocket.isTimeLocked && (
                <Lock color={colors.sage} size={13} strokeWidth={2} />
              )}
              <Text
                style={{
                  ...typography.heading,
                  // A negative balance (from an overridden overspend, see
                  // spend.service.ts's insufficient_funds override flow)
                  // is visually distinct from a normal balance instead of
                  // silently rendering in the same neutral ink color.
                  color: pocket.availableBalance < 0 ? colors.clay : colors.ink,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatCurrency(pocket.availableBalance)}
              </Text>
            </View>
            <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 2 }}>{status}</Text>
          </View>
        </View>
        <View style={{ height: 6, backgroundColor: colors.lineSoft, borderRadius: radius.pill, marginTop: spacing.md, overflow: 'hidden' }}>
          <View
            style={{
              height: '100%',
              borderRadius: radius.pill,
              backgroundColor: pocketColor,
              width: `${pocketProgress * 100}%`,
            }}
          />
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenContainer>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refreshData} tintColor={colors.emeraldDeep} colors={[colors.emeraldDeep]} />
          }
        >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: 26, height: 26 }}
              resizeMode="contain"
            />
            <Text style={{ ...typography.heading, color: colors.ink, letterSpacing: -0.18 }}>Financial Hub</Text>
          </View>
          <Pressable
            onPress={() => setNudgesVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center' }, { opacity: pressed ? 0.8 : 1 }]}
            accessibilityLabel={nudges.length > 0 ? `Nudges, ${nudges.length} new` : 'Nudges'}
            accessibilityRole="button"
          >
            <Bell size={18} color={colors.gold} strokeWidth={2} />
            {nudges.length > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: hasUrgentNudge ? colors.clay : colors.emeraldDeep,
                  borderWidth: 1.5,
                  borderColor: colors.goldTint,
                }}
              />
            )}
          </Pressable>
        </View>

        <View style={{ marginTop: spacing.md, flexDirection: 'row', gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, padding: 3, alignSelf: 'flex-start' }}>
          <Pressable
            style={({ pressed }) => [{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.emeraldDeep }, { opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="button"
            accessibilityState={{ selected: true }}
            accessibilityLabel="You are viewing your personal plan"
          >
            <Text style={{ ...typography.caption, color: colors.surface }}>Personal</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(msme)' as any)}
            style={({ pressed }) => [{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill }, { opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Switch to business plan"
          >
            <Text style={{ ...typography.caption, color: colors.sage }}>Business</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Text style={{ ...typography.caption, color: colors.sage, letterSpacing: 0.36, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>{isDaily ? 'Safe to spend today' : 'Safe to spend'}</Text>
          <Text style={{ ...typography.display, color: colors.emeraldDeep, marginTop: spacing.xs, fontVariant: ['tabular-nums'] }}>{formatCurrency(safeToSpendToday)}</Text>
          <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs }} numberOfLines={2}>
            {isDaily ? 'Sum of what’s left of today’s daily caps' : 'Total across spendable pockets'}
            {' · Rolling last 30 days'}
          </Text>
        </View>

        {runway.applicable && typeof runway.runwayDays === 'number' && (
          <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 }}>
            <View style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={14} color={colors.gold} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, color: colors.ink }}>
                {runway.runwayDays} {runway.runwayDays === 1 ? 'day' : 'days'} of runway
              </Text>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 1 }}>
                {runway.confidence === 'historical'
                  ? 'Based on your recent payments — freelance income comes in bursts, that\u2019s normal'
                  : 'Estimated from your usual pay pattern — we\u2019ll refine this as payments come in'}
              </Text>
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.lineSoft }}>
          <Text style={{ ...typography.caption, color: colors.sage }}>Total balance</Text>
          <Text style={{ ...typography.body, color: colors.inkSoft, fontVariant: ['tabular-nums'] }}>{formatCurrency(totalBalance)}</Text>
        </View>

        <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.emeraldTint, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Shield size={14} color={colors.emeraldDeep} strokeWidth={2} style={{ marginRight: 4 }} />
            <Text style={{ ...typography.caption, color: colors.emeraldDeep, flexShrink: 1 }}>
              {isDaily
                ? 'Savings protected — unspent daily amounts roll over'
                : 'Savings protected — pockets stay on purpose until you move money'}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm }}>
          {(cardOrder[0] === 'reallocation_frequency'
            ? [
                { id: 'move', label: 'Move', icon: ArrowLeftRight, route: '/(modals)/realloc-pick' as const, color: colors.plum },
                { id: 'spend', label: 'Log spend', icon: ShoppingCart, route: '/(pockets)/log-spend' as const, color: colors.clay },
                { id: 'income', label: 'Add income', icon: Plus, route: '/(income)/entry' as const, color: colors.emerald },
              ]
            : [
                { id: 'spend', label: 'Log spend', icon: ShoppingCart, route: '/(pockets)/log-spend' as const, color: colors.clay },
                { id: 'income', label: 'Add income', icon: Plus, route: '/(income)/entry' as const, color: colors.emerald },
                { id: 'move', label: 'Move', icon: ArrowLeftRight, route: '/(modals)/realloc-pick' as const, color: colors.plum },
              ]
          ).map((action) => {
            const Icon = action.icon;
            return (
              <Pressable
                key={action.id}
                style={({ pressed }) => [{
                  flex: 1,
                  minHeight: touchTarget.minHeight,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: radius.sm,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                }, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => router.push(action.route as any)}
                accessibilityLabel={action.label}
                accessibilityRole="button"
              >
                <Icon size={18} color={action.color} strokeWidth={2} />
                <Text style={{ ...typography.caption, color: colors.ink, textAlign: 'center' }}>{action.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          style={({ pressed }) => [{ marginTop: spacing.sm, alignItems: 'center' }, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setActionsVisible(true)}
          accessibilityLabel="Manage pockets and loans"
          accessibilityRole="button"
        >
          <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>Manage pockets & loans</Text>
        </Pressable>

        {isDaily && (
          <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, marginRight: spacing.md }}>
              <View style={{ width: 32, height: 32, borderRadius: radius.xs, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <RefreshCw size={16} color={colors.gold} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.heading, color: colors.ink }} numberOfLines={1}>Today's rollover</Text>
                <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 1 }} numberOfLines={1}>Unspent daily amounts roll to Savings at midnight</Text>
              </View>
            </View>
            <Text style={{ ...typography.body, color: colors.emeraldDeep, fontVariant: ['tabular-nums'], flexShrink: 0 }}>{formatCurrency(rolloverAmount)}</Text>
          </View>
        )}

        {isDaily && dailyPockets.length > 0 && (
          <>
            <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Spendable pockets</Text>

            {dailyPockets.map((pocket) => {
              return (
                <Pressable
                  key={pocket.id}
                  style={({ pressed }) => [{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.lg, marginBottom: spacing.md, ...shadow.default }, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={() => router.push(`/(pockets)/detail?id=${pocket.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${pocket.name} pocket, ${formatCurrency(pocket.remaining)} left of today's ${formatCurrency(pocket.cap)} cap, ${formatCurrency(pocket.fullBalance)} total in pocket`}
                >
                  <View style={{ borderTopWidth: 1.5, borderTopColor: pocket.color, borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
                  <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: pocket.color }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      {pocket.category ? (
                        <CategoryIcon category={pocket.category} size={16} />
                      ) : (
                        <PocketGlyph kind="spendable" color={pocket.color} size={16} muted />
                      )}
                      <Text style={{ ...typography.heading, color: colors.ink }}>{pocket.name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {/* Today's cap is the primary, largest figure — the
                          number the daily-budget plan is actually paced
                          against. Full pocket balance is secondary, shown
                          smaller and muted below it, so it reads as
                          context rather than competing with today's number. */}
                      <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatCurrency(pocket.remaining)} left today</Text>
                      <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2, fontVariant: ['tabular-nums'] }}>/ {formatCurrency(pocket.cap)} daily cap</Text>
                    </View>
                  </View>
                  <View style={{ height: 6, backgroundColor: colors.lineSoft, borderRadius: radius.pill, marginTop: spacing.md, overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        borderRadius: radius.pill,
                        backgroundColor: pocket.color,
                        width: `${Math.max(0, Math.min(100, pocket.progress * 100))}%`,
                      }}
                    />
                  </View>
                  <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.sm, fontVariant: ['tabular-nums'] }}>
                    {formatCurrency(pocket.fullBalance)} total in pocket
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}

        {!isDaily && pocketSectionOrder.map((section) => {
          if (section === 'spendable' && structuredSpendablePockets.length > 0) {
            const isExpanded = expandedSections.spendable;
            const showAll = isExpanded || structuredSpendablePockets.length <= 3;
            const displayPockets = showAll ? structuredSpendablePockets : structuredSpendablePockets.slice(0, 3);
            return (
              <React.Fragment key="spendable">
                <Pressable
                  onPress={() => setExpandedSections(prev => ({ ...prev, spendable: !prev.spendable }))}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md }}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle spendable pockets section`}
                >
                  <Text style={{ ...typography.eyebrow, color: colors.ink }}>Spendable pockets</Text>
                  {structuredSpendablePockets.length > 3 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={{ ...typography.caption, color: colors.sage }}>
                        {isExpanded ? 'Show less' : `${structuredSpendablePockets.length - 3} more`}
                      </Text>
                      {isExpanded ? <ChevronUp size={16} color={colors.sage} /> : <ChevronDown size={16} color={colors.sage} />}
                    </View>
                  )}
                </Pressable>
                {displayPockets.map(renderPocketCard)}
              </React.Fragment>
            );
          }
          if (section === 'fixed' && fixedPockets.length > 0) {
            const isExpanded = expandedSections.fixed;
            const showAll = isExpanded || fixedPockets.length <= 3;
            const displayPockets = showAll ? fixedPockets : fixedPockets.slice(0, 3);
            return (
              <React.Fragment key="fixed">
                <Pressable
                  onPress={() => setExpandedSections(prev => ({ ...prev, fixed: !prev.fixed }))}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md }}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle fixed costs section`}
                >
                  <Text style={{ ...typography.eyebrow, color: colors.ink }}>Fixed costs</Text>
                  {fixedPockets.length > 3 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={{ ...typography.caption, color: colors.sage }}>
                        {isExpanded ? 'Show less' : `${fixedPockets.length - 3} more`}
                      </Text>
                      {isExpanded ? <ChevronUp size={16} color={colors.sage} /> : <ChevronDown size={16} color={colors.sage} />}
                    </View>
                  )}
                </Pressable>
                {displayPockets.map(renderPocketCard)}
              </React.Fragment>
            );
          }
          if (section === 'savings' && savingsPockets.length > 0) {
            const isExpanded = expandedSections.savings;
            const showAll = isExpanded || savingsPockets.length <= 3;
            const displayPockets = showAll ? savingsPockets : savingsPockets.slice(0, 3);
            return (
              <React.Fragment key="savings">
                <Pressable
                  onPress={() => setExpandedSections(prev => ({ ...prev, savings: !prev.savings }))}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md }}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle savings section`}
                >
                  <Text style={{ ...typography.eyebrow, color: colors.ink }}>Savings</Text>
                  {savingsPockets.length > 3 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={{ ...typography.caption, color: colors.sage }}>
                        {isExpanded ? 'Show less' : `${savingsPockets.length - 3} more`}
                      </Text>
                      {isExpanded ? <ChevronUp size={16} color={colors.sage} /> : <ChevronDown size={16} color={colors.sage} />}
                    </View>
                  )}
                </Pressable>
                {displayPockets.map(renderPocketCard)}
              </React.Fragment>
            );
          }
          return null;
        })}

        {isDaily && savingsPockets.length > 0 && (
          <>
            <Pressable
              onPress={() => setExpandedSections(prev => ({ ...prev, savings: !prev.savings }))}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md }}
              accessibilityRole="button"
              accessibilityLabel={`Toggle savings section`}
            >
              <Text style={{ ...typography.eyebrow, color: colors.ink }}>Savings</Text>
              {savingsPockets.length > 3 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Text style={{ ...typography.caption, color: colors.sage }}>
                    {expandedSections.savings ? 'Show less' : `${savingsPockets.length - 3} more`}
                  </Text>
                  {expandedSections.savings ? <ChevronUp size={16} color={colors.sage} /> : <ChevronDown size={16} color={colors.sage} />}
                </View>
              )}
            </Pressable>
            {(expandedSections.savings || savingsPockets.length <= 3 ? savingsPockets : savingsPockets.slice(0, 3)).map(renderPocketCard)}
          </>
        )}
        {isDaily && fixedPockets.length > 0 && (
          <>
            <Pressable
              onPress={() => setExpandedSections(prev => ({ ...prev, fixed: !prev.fixed }))}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md }}
              accessibilityRole="button"
              accessibilityLabel={`Toggle fixed costs section`}
            >
              <Text style={{ ...typography.eyebrow, color: colors.ink }}>Fixed costs</Text>
              {fixedPockets.length > 3 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Text style={{ ...typography.caption, color: colors.sage }}>
                    {expandedSections.fixed ? 'Show less' : `${fixedPockets.length - 3} more`}
                  </Text>
                  {expandedSections.fixed ? <ChevronUp size={16} color={colors.sage} /> : <ChevronDown size={16} color={colors.sage} />}
                </View>
              )}
            </Pressable>
            {(expandedSections.fixed || fixedPockets.length <= 3 ? fixedPockets : fixedPockets.slice(0, 3)).map(renderPocketCard)}
          </>
        )}

        {/* Emergency Unlock Banner */}
        {showEmergencyUnlock && (
          <Pressable
            style={({ pressed }) => [{
              marginTop: spacing.lg,
              backgroundColor: colors.clayTint,
              borderRadius: radius.md,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.clay,
            }, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => setEmergencyUnlockVisible(true)}
            accessibilityLabel="Emergency unlock from savings"
            accessibilityRole="button"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.clay, alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} color={colors.surface} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.heading, color: colors.ink }}>Your pockets are empty</Text>
                <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                  Unlock emergency funds from savings to cover daily expenses
                </Text>
              </View>
              <Text style={{ ...typography.caption, color: colors.clay }}>Tap to unlock →</Text>
            </View>
          </Pressable>
        )}
      </ScrollView>

      </View>

      <NudgesSheet visible={nudgesVisible} onClose={() => setNudgesVisible(false)} nudges={nudges} />
      <EmergencyUnlockSheet
        visible={emergencyUnlockVisible}
        onClose={() => setEmergencyUnlockVisible(false)}
        onUnlock={handleEmergencyUnlock}
        isLoading={isUnlocking}
        pockets={pockets.filter((p) => p.kind !== 'savings')}
      />
      <ActionsSheet visible={actionsVisible} onClose={() => setActionsVisible(false)} />
      {modal}
    </ScreenContainer>
  );
}