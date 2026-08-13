import React from 'react';
import { View, Text, Image, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import {
  Shield, RefreshCw, PiggyBank, House, ShoppingBasket, User, Car, Lock,
  ArrowLeftRight, Plus, Lightbulb, HeartPulse, GraduationCap, Wifi, Package,
  Calendar, TrendingUp,
} from 'lucide-react-native';
import { useHomeStore } from '@/services/home-store';
import { useDataSync } from '@/services/data-sync';
import { useAuthStore } from '@/services/auth';
import { loansApi } from '@/services/api';
import { ScreenContainer, LoadingState, ErrorState } from '@/components/ui';

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
    runway,
    isLoading,
    error,
    fetchHomeData,
    refreshData,
  } = useHomeStore();

  const user = useAuthStore(s => s.user);
  const initials = React.useMemo(() => {
    const name = user?.fullName?.trim();
    if (!name) return '—';
    const parts = name.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || '—';
  }, [user?.fullName]);
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

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

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

  const getPocketStatus = (pocket: any) => {
    if (pocket.kind === 'fixed') return { label: 'Settled', status: 'Settled' };
    if (pocket.kind === 'savings') return { label: 'Protected', status: 'Protected' };
    return { label: 'Monthly budget', status: 'Monthly budget' };
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

  const fixedPockets = pockets.filter(p => p.kind === 'fixed' || p.kind === 'savings');
  // In the structured plan, spendable pockets don't have a daily cap — they're
  // shown as monthly-allocation cards alongside fixed & savings pockets
  // instead of the daily budget strip.
  const structuredSpendablePockets = pockets.filter(p => p.kind === 'spendable');
  const isDaily = planType === 'daily';

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
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center' }}
            accessibilityLabel="Go to profile"
            accessibilityRole="button"
          >
            <Text style={{ ...typography.heading, color: colors.gold, fontSize: 14 }}>{initials}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Text style={{ ...typography.caption, color: colors.sage, letterSpacing: 0.36, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>{isDaily ? 'Safe to spend today' : 'Safe to spend'}</Text>
          <Text style={{ ...typography.display, color: colors.emeraldDeep, marginTop: spacing.xs, fontVariant: ['tabular-nums'] }}>{formatCurrency(safeToSpendToday)}</Text>
          <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs }}>{isDaily ? 'Sum of daily caps' : 'Total across spendable pockets'}</Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Shield size={14} color={colors.emeraldDeep} strokeWidth={2} style={{ marginRight: 4 }} />
            <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>Savings protected — unspent daily amounts roll over</Text>
          </View>
        </View>

        <TouchableOpacity
          style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md }}
          activeOpacity={0.8}
          onPress={() => router.push('/(modals)/realloc-pick')}
          accessibilityLabel="Reallocate money between pockets"
          accessibilityRole="button"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.plumTint, alignItems: 'center', justifyContent: 'center' }}>
              <ArrowLeftRight size={16} color={colors.plum} strokeWidth={2} />
            </View>
            <Text style={{ ...typography.body, color: colors.ink }}>Reallocate money between pockets</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md }}
          activeOpacity={0.8}
          onPress={() => router.push('/(income)/entry')}
          accessibilityLabel="Add income"
          accessibilityRole="button"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={16} color={colors.emeraldDeep} strokeWidth={2} />
            </View>
            <Text style={{ ...typography.body, color: colors.ink }}>Add income</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md }}
          activeOpacity={0.8}
          onPress={() => router.push('/(loans)')}
          accessibilityLabel="Manage loans"
          accessibilityRole="button"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.plumTint, alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color={colors.plum} strokeWidth={2} />
            </View>
            <Text style={{ ...typography.body, color: colors.ink }}>Manage loans</Text>
          </View>
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
                  accessibilityLabel={`${pocket.name} pocket, ${pocket.remaining} left of ${pocket.cap} cap`}
                >
                  <View style={{ borderTopWidth: 1.5, borderTopColor: pocket.color, borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
                  <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: pocket.color }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <PocketIcon color={pocket.color} size={14} />
                      <Text style={{ ...typography.heading, color: colors.ink }}>{pocket.name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{pocket.remaining} left</Text>
                      <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2, fontVariant: ['tabular-nums'] }}>/ {pocket.cap} cap</Text>
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

        {!isDaily && structuredSpendablePockets.length > 0 && (
          <>
            <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Spendable pockets</Text>

            {structuredSpendablePockets.map((pocket) => {
              const pocketColor = getPocketColor(pocket.kind, pocket.category);
              const status = getPocketStatus(pocket);
              const PocketIcon = getPocketIcon(pocket.category, pocket.kind);
              // Bar and headline number must reflect real ledger money
              // (availableBalance), not the onboarding-time planning ceiling
              // (monthlyAllocation) — otherwise every pocket looks "full"
              // the instant a plan is created, before any income has ever
              // been logged. See home-store.ts: availableBalance is the
              // only field derived from actual transactions.
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
                  accessibilityLabel={`${pocket.name} pocket, ${formatCurrency(pocket.availableBalance)} of ${formatCurrency(pocket.monthlyAllocation)} planned`}
                >
                  <View style={{ borderTopWidth: 1.5, borderTopColor: pocketColor, borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
                  <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: pocketColor }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <PocketIcon color={pocketColor} size={14} />
                      <Text style={{ ...typography.heading, color: colors.ink }}>{pocket.name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatCurrency(pocket.availableBalance)}</Text>
                      <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 2, fontVariant: ['tabular-nums'] }}>of {formatCurrency(pocket.monthlyAllocation)} planned</Text>
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                    <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>{status.label}</Text>
                    <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>{pocket.availableBalance > 0 ? 'Available' : 'Awaiting income'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {fixedPockets.length > 0 && (
          <>
            <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Fixed & Protected</Text>

            {fixedPockets.map((pocket) => {
              const pocketColor = getPocketColor(pocket.kind, pocket.category);
              const status = getPocketStatus(pocket);
              const PocketIcon = getPocketIcon(pocket.category, pocket.kind);
              // Same ledger-derived rule as the spendable cards above:
              // monthlyAllocation is the plan's target for this pocket,
              // availableBalance is what's actually been funded via a
              // logged income event.
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
                  accessibilityLabel={`${pocket.name} pocket, ${formatCurrency(pocket.availableBalance)} of ${formatCurrency(pocket.monthlyAllocation)} planned`}
                >
                  <View style={{ borderTopWidth: 1.5, borderTopColor: pocketColor, borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
                  <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: pocketColor }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <PocketIcon color={pocketColor} size={14} />
                      <Text style={{ ...typography.heading, color: colors.ink }}>{pocket.name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {pocket.isTimeLocked && (
                          <PocketIconLock color={colors.sage} size={13} />
                        )}
                        <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatCurrency(pocket.availableBalance)}</Text>
                      </View>
                      <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 2, fontVariant: ['tabular-nums'] }}>of {formatCurrency(pocket.monthlyAllocation)} planned</Text>
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                    <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>{status.label}</Text>
                    <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>{pocket.isTimeLocked ? 'Locked' : pocket.availableBalance > 0 ? 'Available' : 'Awaiting income'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}