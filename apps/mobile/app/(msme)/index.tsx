import React from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { radius, spacing, typography, touchTarget, shadow } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, LoadingState, ErrorState, SearchBar } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { pocketsApi } from '@/services/api';
import { useAuthStore } from '@/services/auth';
import { Plus, Store, Package, ChevronDown, ChevronUp, Receipt } from 'lucide-react-native';
import { formatMoney } from '@/utils/money';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { BUSINESS_CATEGORIES, useOnboardingStore } from '@/services/onboarding-store';

interface MsmePocket {
  id: string;
  name: string;
  kind: string;
  category?: string | null;
  monthly_allocation: number;
  available_balance: number;
  is_time_locked: boolean;
}

type ViewState =
  | { status: 'loading' }
  | { status: 'disabled' }
  | { status: 'error'; message: string }
  | { status: 'empty-msme' }
  | { status: 'empty-neither' }
  | { status: 'ready'; pockets: MsmePocket[] };

function categoryLabel(category?: string | null): string {
  if (!category) return '';
  const key = (['stock', 'supplier', 'licence', 'tax', 'salary', 'rent', 'operations', 'profit', 'owner_draw', 'growth', 'marketing', 'equipment'] as const).find((c) => c === category);
  const entry = key ? BUSINESS_CATEGORIES.find((c) => c.id === key) : undefined;
  return entry?.label ?? '';
}

export default function MsmeHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { alert, modal } = useAlertModal();
  const user = useAuthStore((state) => state.user);

  const [view, setView] = React.useState<ViewState>({ status: 'loading' });
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pocketSearch, setPocketSearch] = React.useState('');
  const [showAllPockets, setShowAllPockets] = React.useState(false);

  const load = React.useCallback(async () => {
    if (user?.featureFlags?.msme_segment === false) {
      setView({ status: 'disabled' });
      return;
    }
    try {
      const [msme, individual] = await Promise.all([
        pocketsApi.getAll('msme').catch(() => []),
        pocketsApi.getAll('individual').catch(() => []),
      ]);
      if (msme.length > 0) {
        setView({ status: 'ready', pockets: msme });
      } else if (individual.length > 0) {
        setView({ status: 'empty-msme' });
      } else {
        setView({ status: 'empty-neither' });
      }
    } catch (error) {
      setView({ status: 'error', message: error instanceof Error ? error.message : 'Failed to load' });
    }
  }, [user]);

  React.useEffect(() => {
    load();
  }, [load]);

  const isFirstFocus = React.useRef(true);
  useFocusEffect(
    React.useCallback(() => {
      if (isFirstFocus.current) { isFirstFocus.current = false; return; }
      load();
    }, [load]),
  );

  const refresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const switchPersonal = async () => {
    router.replace('/(tabs)');
  };

  const renderHeader = () => (
    <>
      {/* Top brand row — mirrors (tabs)/index.tsx:309 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Image
            source={require('../../assets/icon.png')}
            style={{ width: 26, height: 26 }}
            resizeMode="contain"
          />
          <Text style={{ ...typography.heading, color: colors.ink, letterSpacing: -0.18 }}>Financial Hub</Text>
        </View>
      </View>
      {/* Segment toggle — below header, left-aligned pill like (tabs)/index.tsx:344 (not crammed into header row) */}
      <View
        style={{
          marginTop: spacing.md,
          flexDirection: 'row',
          gap: spacing.xs,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radius.pill,
          padding: 3,
          alignSelf: 'flex-start',
        }}
      >
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => [{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill }, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Switch to personal plan"
        >
          <Text style={{ ...typography.caption, color: colors.sage }}>Personal</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.emeraldDeep }, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          accessibilityLabel="You are viewing your business plan"
        >
          <Text style={{ ...typography.caption, color: colors.surface }}>Business</Text>
        </Pressable>
      </View>
    </>
  );

  const renderEmpty = () => {
    const isMsmeOnly = view.status === 'empty-msme';
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg }}>
        <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
          <Store size={32} color={colors.gold} strokeWidth={2} />
        </View>
        <Text style={{ ...typography.title, color: colors.ink, textAlign: 'center' }}>
          {isMsmeOnly ? 'No business plan yet' : 'Start a money plan'}
        </Text>
        <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, textAlign: 'center', lineHeight: 21 }}>
          {isMsmeOnly
            ? 'Your personal plan is safe. Add a business plan to split revenue into stock, suppliers, and profit pockets.'
            : 'Complete onboarding to create your personalized pockets for savings, fixed costs, and daily spending.'}
        </Text>
        <Pressable
          style={({ pressed }) => [{ marginTop: spacing.lg, backgroundColor: colors.emeraldDeep, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl }, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => {
            // Preselect the correct segment so income step opens on the
            // right form (Business vs Personal) without requiring the user
            // to toggle manually. Guard in (onboarding)/_layout now allows
            // creating the missing segment when the user has only one plan.
            useOnboardingStore.getState().setSegment(isMsmeOnly ? 'msme' : 'individual');
            router.push('/(onboarding)/income' as any);
          }}
          accessibilityLabel={isMsmeOnly ? 'Start business onboarding' : 'Start onboarding'}
          accessibilityRole="button"
        >
          <Text style={{ ...typography.heading, color: colors.surface, textAlign: 'center' }}>
            {isMsmeOnly ? 'Add business plan' : 'Start Onboarding'}
          </Text>
        </Pressable>
        {isMsmeOnly && (
          <Pressable
            style={({ pressed }) => [{ marginTop: spacing.md, alignItems: 'center' }, { opacity: pressed ? 0.7 : 1 }]}
            onPress={switchPersonal}
            accessibilityRole="button"
            accessibilityLabel="Go to personal plan"
          >
            <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>Back to personal plan</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderPocketCard = (pocket: MsmePocket) => {
    const color = pocket.kind === 'fixed'
      ? colors.gold
      : pocket.kind === 'savings'
        ? colors.emeraldDeep
        : colors.plum;
    const Icon = getCategoryIcon((pocket.category as any) || 'operations');
    const progress = pocket.monthly_allocation > 0
      ? Math.max(0, Math.min(1, pocket.available_balance / pocket.monthly_allocation))
      : 0;
    const label = categoryLabel(pocket.category);
    // Avoid duplicate "Rent / Rent" — if label matches name, show kind purpose instead
    const subLabel = label && label.toLowerCase() !== pocket.name.toLowerCase()
      ? label
      : pocket.kind === 'savings' ? 'Savings' : pocket.kind === 'fixed' ? 'Fixed costs' : 'Business pocket';
    const status = pocket.available_balance <= 0 ? 'Awaiting income' : pocket.kind === 'savings' ? 'Protected' : pocket.kind === 'fixed' ? 'Funded' : 'Available';
    const statusBg = status === 'Protected' ? colors.emeraldTint : status === 'Funded' ? colors.goldTint : status === 'Available' ? colors.emeraldTint : colors.lineSoft;
    const statusColor = status === 'Protected' ? colors.emeraldDeep : status === 'Funded' ? colors.gold : status === 'Available' ? colors.emeraldDeep : colors.sage;
    const statusBorder = status === 'Protected' ? colors.emeraldDeep + '30' : status === 'Funded' ? colors.gold + '30' : status === 'Available' ? colors.emeraldDeep + '30' : colors.line;
    return (
      <Pressable
        key={pocket.id}
        style={({ pressed }) => [{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.lg, marginBottom: spacing.md, ...shadow.default }, { opacity: pressed ? 0.8 : 1 }]}
        onPress={() => router.push(`/(pockets)/detail?id=${pocket.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${pocket.name} pocket, ${subLabel}, ${formatMoney(pocket.available_balance)} available, ${status}`}
      >
        {/* dashed top + tab — identical to (tabs)/index.tsx pocket card */}
        <View style={{ borderTopWidth: 1.5, borderTopColor: color, borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
        <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: color }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, paddingRight: spacing.sm }}>
            <View style={{ width: 28, height: 28, borderRadius: radius.xs, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={16} color={colors.ink} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }} numberOfLines={1}>{pocket.name}</Text>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 2 }} numberOfLines={1}>{subLabel}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', flexShrink: 0, gap: 4 }}>
            <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatMoney(pocket.available_balance)}</Text>
            <View style={{ backgroundColor: statusBg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: statusBorder, minHeight: 20, justifyContent: 'center' }}>
              <Text style={{ ...typography.caption, fontSize: 10, color: statusColor, lineHeight: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 }}>{status}</Text>
            </View>
          </View>
        </View>
        <View style={{ height: 6, backgroundColor: colors.lineSoft, borderRadius: radius.pill, marginTop: spacing.md, overflow: 'hidden' }}>
          <View style={{ height: '100%', borderRadius: radius.pill, backgroundColor: color, width: `${progress * 100}%` }} />
        </View>
        <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs }}>{formatMoney(pocket.available_balance)} of {formatMoney(pocket.monthly_allocation)} monthly</Text>
      </Pressable>
    );
  };

  if (view.status === 'loading') {
    return (
      <ScreenContainer>
        {renderHeader()}
        <LoadingState label="Loading your business hub…" variant="home" />
      </ScreenContainer>
    );
  }

  if (view.status === 'error') {
    return (
      <ScreenContainer>
        {renderHeader()}
        <ErrorState message={view.message} onRetry={refresh} />
      </ScreenContainer>
    );
  }

  if (view.status === 'disabled') {
    return (
      <ScreenContainer>
        {renderHeader()}
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg }}>
          <Text style={{ ...typography.title, color: colors.ink, textAlign: 'center' }}>
            MSME Feature Preview
          </Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, textAlign: 'center', lineHeight: 21 }}>
            Business management features are rolling out in phases. Access will be unlocked for your account shortly.
          </Text>
          <Pressable
            style={({ pressed }) => [{ marginTop: spacing.lg, backgroundColor: colors.emeraldDeep, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl }, { opacity: pressed ? 0.7 : 1 }]}
            onPress={switchPersonal}
            accessibilityRole="button"
          >
            <Text style={{ ...typography.heading, color: colors.surface }}>Go to Personal Plan</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  if (view.status === 'empty-msme' || view.status === 'empty-neither') {
    return (
      <ScreenContainer>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          {renderHeader()}
          {renderEmpty()}
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ── Derived filtering + collapsible (MSME info-overload §28 #1, Phase 6) ──
  const MSME_POCKET_COLLAPSE_AT = 4;
  const allPockets = view.status === 'ready' ? view.pockets : [];
  const filteredPockets = allPockets.filter(p => {
    if (pocketSearch.trim() === '') return true;
    const q = pocketSearch.trim().toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q));
  });
  const visiblePockets = showAllPockets ? filteredPockets : filteredPockets.slice(0, MSME_POCKET_COLLAPSE_AT);
  const hiddenCount = Math.max(0, filteredPockets.length - MSME_POCKET_COLLAPSE_AT);

  // ── Aligned hero + stats — mirrors (tabs)/index.tsx information hierarchy
  const totalBusinessBalance = allPockets.reduce((s, p) => s + (p.available_balance || 0), 0);
  const totalMonthlyAllocation = allPockets.reduce((s, p) => s + (p.monthly_allocation || 0), 0);

  return (
    <ScreenContainer>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.emeraldDeep} colors={[colors.emeraldDeep]} />
          }
        >
          {renderHeader()}

          {/* Hero — same level and spacing as Individual's Safe to spend block (tabs/index.tsx:363) */}
          <View style={{ marginTop: spacing.xl }}>
            <Text style={{ ...typography.caption, color: colors.sage, letterSpacing: 0.36 }}>Total in business pockets</Text>
            <Text style={{ ...typography.display, color: colors.emeraldDeep, marginTop: spacing.xs, fontVariant: ['tabular-nums'] }}>
              {formatMoney(totalBusinessBalance)}
            </Text>
            <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs }} numberOfLines={2}>
              Across {view.pockets.length} business pockets · {formatMoney(totalMonthlyAllocation)} monthly allocation
            </Text>
          </View>

          <View
            style={{
              marginTop: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTopWidth: 1,
              borderTopColor: colors.lineSoft,
              paddingTop: spacing.md,
            }}
          >
            <Text style={{ ...typography.caption, color: colors.sage }}>Monthly allocation</Text>
            <Text style={{ ...typography.body, color: colors.inkSoft, fontVariant: ['tabular-nums'] }}>{formatMoney(totalMonthlyAllocation)}</Text>
          </View>

          <View
            style={{
              marginTop: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: colors.emeraldTint,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Store size={14} color={colors.emeraldDeep} strokeWidth={2} style={{ marginRight: 4 }} />
              <Text style={{ ...typography.caption, color: colors.emeraldDeep, flexShrink: 1 }}>Business pockets stay on purpose until you move money</Text>
            </View>
          </View>

          {/* Action row — 3 balanced buttons like Individual's Log spend/Add income/Move (tabs/index.tsx:406) */}
          <View style={{ marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm }}>
            {[
              { id: 'income', label: 'Add income', icon: Plus, route: '/(income)/entry?segment=msme' as const, color: colors.emerald },
              { id: 'invoices', label: 'Invoices', icon: Receipt, route: '/msme-invoices' as const, color: colors.gold },
              { id: 'stock', label: 'Stock', icon: Package, route: '/msme-stock' as const, color: colors.plum },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Pressable
                  key={action.id}
                  style={({ pressed }) => [
                    {
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
                    },
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
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
            onPress={() => router.push('/msme-projects/create' as any)}
            accessibilityLabel="Create new project"
            accessibilityRole="button"
          >
            <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>New project · Funding Cascade</Text>
          </Pressable>

          {/* Business pockets — single-column cards like Individual, collapsible with eyebrow */}
          <Pressable
            onPress={() => setShowAllPockets(v => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md, gap: spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel="Toggle business pockets section"
          >
            <Text style={{ ...typography.eyebrow, color: colors.ink }}>Business pockets</Text>
            {allPockets.length > 3 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ backgroundColor: colors.lineSoft, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, minHeight: 22, justifyContent: 'center' }}>
                  <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage, lineHeight: 12, fontWeight: '700' }}>
                    {showAllPockets ? 'Show less' : `${Math.min(MSME_POCKET_COLLAPSE_AT, filteredPockets.length)} of ${filteredPockets.length}`}
                  </Text>
                </View>
                {showAllPockets ? <ChevronUp size={16} color={colors.sage} /> : <ChevronDown size={16} color={colors.sage} />}
              </View>
            )}
          </Pressable>

          {/* Search — above the list like Individual's pocket search */}
          {allPockets.length > 3 && (
            <View style={{ marginBottom: spacing.md }}>
              <SearchBar
                value={pocketSearch}
                onChangeText={(v) => {
                  setPocketSearch(v);
                  if (v.length === 1) setShowAllPockets(true);
                }}
                placeholder="Search pockets…"
                onClear={() => setPocketSearch('')}
              />
            </View>
          )}

          {filteredPockets.length === 0 ? (
            <View
              style={{
                paddingVertical: spacing.xl,
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.md,
              }}
            >
              <Store size={28} color={colors.sage} strokeWidth={2} />
              <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.md }}>No pockets match “{pocketSearch}”</Text>
              <Pressable onPress={() => setPocketSearch('')} style={{ marginTop: spacing.sm }} accessibilityRole="button">
                <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>Clear search</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 0 }}>
              {visiblePockets.map(renderPocketCard)}
            </View>
          )}
          {filteredPockets.length > MSME_POCKET_COLLAPSE_AT && !showAllPockets && (
            <Pressable
              onPress={() => setShowAllPockets(true)}
              style={({ pressed }) => [
                { marginTop: spacing.md, paddingVertical: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.paper },
                { opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Show ${hiddenCount} more pockets`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <ChevronDown size={14} color={colors.emeraldDeep} strokeWidth={2} />
                <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>{`Show ${hiddenCount} more`}</Text>
              </View>
            </Pressable>
          )}

          {/* Operations — distinct section below pockets, like Individual's Fixed/Savings sections */}
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Operations</Text>

          <Pressable
            onPress={() => router.push('/msme-invoices' as any)}
            style={({ pressed }) => [
              { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open invoices — Receivables"
          >
            <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={18} color={colors.gold} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }}>Invoices — Receivables</Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2, lineHeight: 16 }}>Draft → Sent → Paid. KRA PIN validated, overdue flagged, paid allocates to MSME pockets.</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push('/msme-stock' as any)}
            style={({ pressed }) => [
              { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open stock — Inventory"
          >
            <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }}>
              <Package size={18} color={colors.emeraldDeep} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }}>Stock — Inventory</Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2, lineHeight: 16 }}>Qty on hand, low-stock alerts, in/out ledger. Out guards negative.</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push('/msme-projects' as any)}
            style={({ pressed }) => [
              { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open projects — Funding Cascade"
          >
            <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.plumTint, alignItems: 'center', justifyContent: 'center' }}>
              <Store size={18} color={colors.plum} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }}>Projects — Funding Cascade</Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2, lineHeight: 16 }}>Priorities → Needs → Wants · Track Funding vs Spending vs Remaining cash.</Text>
            </View>
          </Pressable>
        </ScrollView>
      </View>
      {modal}
    </ScreenContainer>
  );
}