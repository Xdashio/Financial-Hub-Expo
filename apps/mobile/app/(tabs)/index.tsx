import React from 'react';
import { View, Text, Image, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { radius, spacing, typography, shadow, touchTarget } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import {
  Shield, RefreshCw, PiggyBank, House, ShoppingBasket, User, Car, Lock,
  ArrowLeftRight, Plus, Lightbulb, HeartPulse, GraduationCap, Wifi, Package,
  Calendar, TrendingUp, Bell, ShoppingCart,
} from 'lucide-react-native';
import { useHomeStore } from '@/services/home-store';
import { useDataSync } from '@/services/data-sync';
import { loansApi } from '@/services/api';
import { ScreenContainer, LoadingState, ErrorState } from '@/components/ui';
import { NudgesSheet } from '@/components/home/NudgesSheet';
import { EmergencyUnlockSheet } from '@/components/home/EmergencyUnlockSheet';
import { deriveNudges } from '@/services/nudges';
import { formatMoney } from '@/utils/money';
// Pocket icons — using lucide-react-native so pocket icons stay visually
// consistent (same stroke weight/family) with the rest of the app instead
// of one-off hand-drawn SVG paths.
const PocketIconSavings = PiggyBank;
const PocketIconRent = House;
const PocketIconGroceries = ShoppingBasket;
const PocketIconPersonal = User;
const PocketIconTransport = Car;
const PocketIconLock = Lock;
const PocketIconUtilities = Lightbulb;
const PocketIconHealthcare = HeartPulse;
const PocketIconEducation = GraduationCap;
const PocketIconInternet = Wifi;
const PocketIconOther = Package;

const getPocketIcon = (category?: string, kind?: string) => {
  switch (kind) {
    case 'savings':
      return PocketIconSavings;
    case 'loan':
      return TrendingUp;
    case 'fixed':
      // For fixed pockets, use category to determine icon — previously every
      // category fell through to the same House icon, making the "Fixed &
      // Protected" list look like a row of identical pockets.
      switch (category) {
        case 'housing':
        case 'rent':
          return PocketIconRent;
        case 'utilities':
        case 'bills':
          return PocketIconUtilities;
        case 'internet':
        case 'mobile_data':
          return PocketIconInternet;
        case 'transport':
          return PocketIconTransport;
        case 'healthcare':
          return PocketIconHealthcare;
        case 'education':
          return PocketIconEducation;
        default:
          return PocketIconOther;
      }
    case 'spendable':
      switch (category) {
        case 'food':
        case 'groceries':
          return PocketIconGroceries;
        case 'transport':
          return PocketIconTransport;
        case 'leisure':
        case 'personal':
          return PocketIconPersonal;
        default:
          return PocketIconGroceries;
      }
    default:
      return PocketIconGroceries;
  }
};

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
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
  const [isUnlocking, setIsUnlocking] = React.useState(false);

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
      // TODO: Call the emergency unlock API
      console.log('Emergency unlock amount:', amount);
      await refreshData();
    } catch (error) {
      console.error('Emergency unlock failed:', error);
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
    if (pocket.availableBalance <= 0) return 'Awaiting income';
    if (pocket.kind === 'savings') return 'Protected';
    if (pocket.kind === 'fixed') return 'Funded';
    return 'Available';
  };

  if (isLoading && pockets.length === 0) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading your financial hub…" />
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
            <Text style={{ ...typography.title, color: colors.ink }}>Start Your Money Plan</Text>
            <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, textAlign: 'center', lineHeight: 21 }}>
              Complete onboarding to create your personalized pockets for savings, fixed costs, and daily spending.
            </Text>
            <TouchableOpacity
              style={{
                marginTop: spacing.lg,
                backgroundColor: colors.emeraldDeep,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xl,
              }}
              onPress={() => router.push('/(onboarding)/income')}
              accessibilityLabel="Start onboarding"
              accessibilityRole="button"
            >
              <Text style={{ ...typography.heading, color: colors.surface, textAlign: 'center' }}>
                Start Onboarding
              </Text>
            </TouchableOpacity>
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
    const PocketIcon = getPocketIcon(pocket.category, pocket.kind);
    const pocketProgress = pocket.monthlyAllocation > 0
      ? Math.max(0, Math.min(1, pocket.availableBalance / pocket.monthlyAllocation))
      : 0;
    return (
      <TouchableOpacity
        key={pocket.id}
        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.lg, marginBottom: spacing.md, ...shadow.default }}
        activeOpacity={0.8}
        onPress={() => router.push(`/(pockets)/detail?id=${pocket.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${pocket.name} pocket, ${purpose}, ${formatCurrency(pocket.availableBalance)} available, ${status}`}
      >
        <View style={{ borderTopWidth: 1.5, borderTopColor: pocketColor, borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
        <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: pocketColor }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, paddingRight: spacing.sm }}>
            <PocketIcon color={pocketColor} size={14} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }}>{pocket.name}</Text>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 2 }}>{purpose}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {pocket.isTimeLocked && (
                <PocketIconLock color={colors.sage} size={13} />
              )}
              <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatCurrency(pocket.availableBalance)}</Text>
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
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
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
              source={require('../../assets/financial_hub_logo_transparent.png')}
              style={{ width: 26, height: 26 }}
              resizeMode="contain"
            />
            <Text style={{ ...typography.heading, color: colors.ink, letterSpacing: -0.18 }}>Financial Hub</Text>
          </View>
          <TouchableOpacity
            onPress={() => setNudgesVisible(true)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center' }}
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
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Text style={{ ...typography.caption, color: colors.sage, letterSpacing: 0.36, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>{isDaily ? 'Safe to spend today' : 'Safe to spend'}</Text>
          <Text style={{ ...typography.display, color: colors.emeraldDeep, marginTop: spacing.xs, fontVariant: ['tabular-nums'] }}>{formatCurrency(safeToSpendToday)}</Text>
          <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs }}>
            {isDaily ? 'Sum of daily caps' : 'Total across spendable pockets'}
            {' · '}
            Rolling last 30 days alongside this calendar month
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
                { id: 'move', label: 'Move', icon: ArrowLeftRight, route: '/(modals)/realloc-pick' as const },
                { id: 'spend', label: 'Log spend', icon: ShoppingCart, route: '/(pockets)/log-spend' as const },
                { id: 'income', label: 'Add income', icon: Plus, route: '/(income)/entry' as const },
              ]
            : [
                { id: 'spend', label: 'Log spend', icon: ShoppingCart, route: '/(pockets)/log-spend' as const },
                { id: 'income', label: 'Add income', icon: Plus, route: '/(income)/entry' as const },
                { id: 'move', label: 'Move', icon: ArrowLeftRight, route: '/(modals)/realloc-pick' as const },
              ]
          ).map((action) => {
            const Icon = action.icon;
            return (
              <TouchableOpacity
                key={action.id}
                style={{
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
                }}
                activeOpacity={0.8}
                onPress={() => router.push(action.route as any)}
                accessibilityLabel={action.label}
                accessibilityRole="button"
              >
                <Icon size={18} color={colors.emeraldDeep} strokeWidth={2} />
                <Text style={{ ...typography.caption, color: colors.ink, textAlign: 'center' }}>{action.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={{ marginTop: spacing.sm, alignSelf: 'center', paddingVertical: spacing.sm, minHeight: touchTarget.minHeight, justifyContent: 'center' }}
          activeOpacity={0.8}
          onPress={() => router.push('/(modals)/actions')}
          accessibilityLabel="More money actions"
          accessibilityRole="button"
        >
          <Text style={{ ...typography.caption, color: colors.sage }}>More actions</Text>
        </TouchableOpacity>

        {isDaily && (
          <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 32, height: 32, borderRadius: radius.xs, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={16} color={colors.gold} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={{ ...typography.heading, color: colors.ink }}>Today's rollover</Text>
                <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 1 }}>Unspent amounts move to Savings at midnight</Text>
              </View>
            </View>
            <Text style={{ ...typography.body, color: colors.emeraldDeep, fontVariant: ['tabular-nums'] }}>{formatCurrency(rolloverAmount)}</Text>
          </View>
        )}

        {isDaily && dailyPockets.length > 0 && (
          <>
            <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Spendable pockets</Text>

            {dailyPockets.map((pocket) => {
              const PocketIcon = getPocketIcon(pocket.category, 'spendable');
              return (
                <TouchableOpacity
                  key={pocket.id}
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.lg, marginBottom: spacing.md, ...shadow.default }}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(pockets)/detail?id=${pocket.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${pocket.name} pocket, ${formatCurrency(pocket.remaining)} left of ${formatCurrency(pocket.cap)} cap`}
                >
                  <View style={{ borderTopWidth: 1.5, borderTopColor: pocket.color, borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
                  <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: pocket.color }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <PocketIcon color={pocket.color} size={14} />
                      <Text style={{ ...typography.heading, color: colors.ink }}>{pocket.name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatCurrency(pocket.remaining)} left</Text>
                      <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2, fontVariant: ['tabular-nums'] }}>/ {formatCurrency(pocket.cap)} cap</Text>
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
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {!isDaily && pocketSectionOrder.map((section) => {
          if (section === 'spendable' && structuredSpendablePockets.length > 0) {
            return (
              <React.Fragment key="spendable">
                <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Spendable pockets</Text>
                {structuredSpendablePockets.map(renderPocketCard)}
              </React.Fragment>
            );
          }
          if (section === 'fixed' && fixedPockets.length > 0) {
            return (
              <React.Fragment key="fixed">
                <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Fixed costs</Text>
                {fixedPockets.map(renderPocketCard)}
              </React.Fragment>
            );
          }
          if (section === 'savings' && savingsPockets.length > 0) {
            return (
              <React.Fragment key="savings">
                <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Savings</Text>
                {savingsPockets.map(renderPocketCard)}
              </React.Fragment>
            );
          }
          return null;
        })}

        {isDaily && savingsPockets.length > 0 && (
          <>
            <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Savings</Text>
            {savingsPockets.map(renderPocketCard)}
          </>
        )}
        {isDaily && fixedPockets.length > 0 && (
          <>
            <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Fixed costs</Text>
            {fixedPockets.map(renderPocketCard)}
          </>
        )}

        {/* Emergency Unlock Banner */}
        {showEmergencyUnlock && (
          <TouchableOpacity
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.clayTint,
              borderRadius: radius.md,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.clay,
            }}
            activeOpacity={0.8}
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
          </TouchableOpacity>
        )}
      </ScrollView>

      <NudgesSheet visible={nudgesVisible} onClose={() => setNudgesVisible(false)} nudges={nudges} />
      <EmergencyUnlockSheet
        visible={emergencyUnlockVisible}
        onClose={() => setEmergencyUnlockVisible(false)}
        onUnlock={handleEmergencyUnlock}
        isLoading={isUnlocking}
      />
    </ScreenContainer>
  );
}