import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { radius, spacing, typography, shadow, borderWidth } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { ScreenContainer, LoadingState, ErrorState, InlineLoading, Button } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { getMerchantCategoryLabel } from '@financial-hub/shared';
import { SubPocketRebalanceSheet } from '@/components/pockets/SubPocketRebalanceSheet';
import {
  ArrowLeft,
  ArrowLeftRight,
  ShoppingCart,
  Lock,
  TrendingUp,
  Wallet,
  Store,
  AlertTriangle,
  ShieldCheck,
  CircleDollarSign,
  Layers,
  Plus,
  Sliders,
  Trash2,
} from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  amount: number;
  type: 'spend' | 'allocation' | 'reallocation_in' | 'reallocation_out' | string;
  merchant: string | null;
  category: string | null;
  created_at: string;
}

interface PocketSummary {
  pocket: {
    id: string;
    name: string;
    kind: 'savings' | 'fixed' | 'spendable' | 'loan';
    category: string | null;
    monthly_allocation: number;
    daily_cap: number | null;
    is_time_locked: boolean;
    lock_until: string | null;
    // Sub-pockets (audit_team.md item 10): null for a top-level pocket,
    // set for a sub-pocket nested under a parent. See
    // POST/GET /pockets/:id/sub-pockets.
    parent_pocket_id?: string | null;
  };
  summary: {
    available: number;
    spent: number;
    remaining: number;
    percentage_remaining: number;
    monthly_allocation: number;
    days_remaining: number;
    daily_average_spend: number;
  };
  recent_activity: {
    last_transaction: string | null;
    transaction_count: number;
    reallocation_count: number;
  };
}

// Sub-pockets (audit_team.md item 10): ordinary pockets nested one level
// under a parent, e.g. splitting a Loans pocket into "Repayment" + purpose
// sub-pockets. Returned by GET /pockets/:id/sub-pockets with a
// ledger-derived available_balance, same shape as the enriched top-level
// list in useHomeStore.
interface SubPocket {
  id: string;
  name: string;
  kind: 'savings' | 'fixed' | 'spendable' | 'loan';
  category: string | null;
  monthly_allocation: number;
  available_balance: number;
  split_percentage: number | null;
}

interface MerchantScope {
  pocket_id: string;
  pocket_name: string;
  pocket_kind: string;
  merchant_scope: {
    allowed_categories: string[];
    blocked_categories: string[];
    classification_mode: string;
    unclassified_handling: string;
  };
  saved_classifications: Array<{
    recipient_key: string;
    category: string;
    remember: boolean;
    created_at: string;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return formatMoney(amount);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const time = d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today, ${time}`;
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }) + `, ${time}`;
}

function txLabel(tx: Transaction) {
  if (tx.merchant) return tx.merchant;
  switch (tx.type) {
    case 'allocation': return 'Allocation from income';
    case 'reallocation_in': return 'Moved in from another pocket';
    case 'reallocation_out': return 'Moved to another pocket';
    case 'spend': return tx.category ? tx.category : 'Spend';
    default: return tx.type;
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TxRow({ tx, colors }: { tx: Transaction; colors: any }) {
  const isDebit = tx.type === 'spend' || tx.type === 'reallocation_out';

  const Icon =
    tx.type === 'spend'
      ? ShoppingCart
      : tx.type === 'allocation'
      ? CircleDollarSign
      : tx.type === 'reallocation_in'
      ? TrendingUp
      : tx.type === 'reallocation_out'
      ? ArrowLeftRight
      : Wallet;

  const iconColor = isDebit ? colors.clay : colors.emeraldDeep;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: borderWidth,
        borderBottomColor: colors.lineSoft,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.xs,
          backgroundColor: isDebit ? colors.clayTint : colors.emeraldTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={16} color={iconColor} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.heading, color: colors.ink }} numberOfLines={1}>
          {txLabel(tx)}
        </Text>
        <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
          {fmtDate(tx.created_at)}
        </Text>
      </View>
      <Text
        style={{
          ...typography.heading,
          color: isDebit ? colors.clay : colors.emeraldDeep,
          fontVariant: ['tabular-nums'],
        }}
      >
        {/* reallocation_out rows are stored with a negative ledger amount
            (see ReallocationsService), so without Math.abs here this rendered
            as a double negative, e.g. "−KES -500" instead of "−KES 500". */}
        {isDebit ? '−' : '+'}{fmt(Math.abs(tx.amount))}
      </Text>
    </View>
  );
}

function CategoryChip({ label, blocked, colors }: { label: string; blocked?: boolean; colors: any }) {
  return (
    <View
      style={{
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: blocked ? colors.clayTint : colors.emeraldTint,
        borderWidth: borderWidth,
        borderColor: blocked ? colors.clay + '40' : colors.emeraldDeep + '30',
        marginRight: spacing.xs,
        marginBottom: spacing.xs,
      }}
    >
      <Text
        style={{
          ...typography.caption,
          color: blocked ? colors.clay : colors.emeraldDeep,
        }}
      >
        {getMerchantCategoryLabel(label)}
      </Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function PocketDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alert, confirm, modal } = useAlertModal();

  const [summary, setSummary] = useState<PocketSummary | null>(null);
  const [scope, setScope] = useState<MerchantScope | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subPockets, setSubPockets] = useState<SubPocket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeFailed, setScopeFailed] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rebalanceSheetVisible, setRebalanceSheetVisible] = useState(false);

  const isFirstFocus = useRef(true);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setScopeFailed(false);
      const [s, txPage, sc, subs] = await Promise.all([
        pocketsApi.getSummary(id),
        pocketsApi.getTransactions(id, 1, 20),
        pocketsApi.getMerchantScope(id).then(
          (result) => ({ ok: true as const, result }),
          () => ({ ok: false as const, result: null })
        ),
        // Empty for a pocket that's itself a sub-pocket (nothing has it as
        // a parent) — harmless, the section below just won't render.
        pocketsApi.getSubPockets(id).catch(() => []),
      ]);
      setSummary(s);
      setTransactions(txPage.transactions ?? []);
      setPage(1);
      setHasMore((txPage.pagination?.page ?? 1) < (txPage.pagination?.totalPages ?? 1));
      setLoadMoreError(false);
      setSubPockets(subs ?? []);
      if (sc.ok) {
        setScope(sc.result);
      } else {
        setScope(null);
        setScopeFailed(true);
      }
    } catch (e) {
      console.error('PocketDetail load error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to load pocket data';
      setError(errorMessage);
    }
  }, [id]);

  // Initial load
  React.useEffect(() => {
    setIsLoading(true);
    setError(null);
    loadAll().finally(() => setIsLoading(false));
  }, [loadAll]);

  // Reload on focus (coming back from log-spend / realloc)
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) { isFirstFocus.current = false; return; }
      loadAll();
    }, [loadAll])
  );

  // Defense-in-depth against the focus effect above — see
  // src/services/data-sync.ts. Some flows (reallocation, income) can
  // finish without ever handing focus back to this screen; this refetches
  // as soon as any of them report a change, regardless of navigation.
  const dataVersion = useDataSync(s => s.version);
  const isFirstVersion = useRef(true);
  React.useEffect(() => {
    if (isFirstVersion.current) { isFirstVersion.current = false; return; }
    loadAll();
  }, [dataVersion, loadAll]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    await loadAll();
    setIsRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || !id) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const next = page + 1;
      const txPage = await pocketsApi.getTransactions(id, next, 20);
      setTransactions(prev => [...prev, ...(txPage.transactions ?? [])]);
      setPage(next);
      setHasMore(next < (txPage.pagination?.totalPages ?? 1));
    } catch (e) {
      console.error('loadMore error:', e);
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const goBack = () => {
    safeGoBack(router, '/(tabs)');
  };

  const confirmDeleteSubPocket = async (subPocket: SubPocket) => {
    const confirmed = await confirm(
      `Delete "${subPocket.name}"?`,
      'This removes the sub-pocket. Its balance must be zero first — if it still holds money, move it out via reallocation before deleting.',
      { destructive: true }
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await pocketsApi.deleteSubPocket(subPocket.id);
      await loadAll();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete this sub-pocket.');
      await alert('Error', deleteError || 'Could not delete this sub-pocket.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const pocket = summary?.pocket;
  const stat = summary?.summary;
  const activity = summary?.recent_activity;

  const pocketColor =
    pocket?.kind === 'savings'
      ? colors.emeraldDeep
      : pocket?.kind === 'fixed'
      ? colors.gold
      : pocket?.kind === 'loan'
      ? colors.plum
      : pocket?.category === 'transport'
      ? colors.plum
      : pocket?.category === 'leisure'
      ? colors.clay
      : colors.emerald;

  const pctRemaining = Math.max(0, Math.min(100, stat?.percentage_remaining ?? 0));

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <ScreenContainer>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <Pressable
            onPress={goBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: spacing.xs, marginRight: spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink }}>Pocket</Text>
        </View>
        <LoadingState label="Loading pocket…" />
      </ScreenContainer>
    );
  }

  if (!summary) {
    return (
      <ScreenContainer>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <Pressable
            onPress={goBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: spacing.xs, marginRight: spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink }}>Pocket</Text>
        </View>
        <ErrorState message={error || "Couldn't load pocket data."} onRetry={onRefresh} />
      </ScreenContainer>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScreenContainer>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.emeraldDeep} />
        }
        onScrollEndDrag={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
          if (nearBottom) loadMore();
        }}
      >
        {/* ── Header ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <Pressable
            onPress={goBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: spacing.xs, marginRight: spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, flex: 1 }} numberOfLines={1}>
            {pocket?.name}
          </Text>
          {pocket?.is_time_locked && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.goldTint,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
              }}
            >
              <Lock size={12} color={colors.gold} strokeWidth={2} />
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.gold }}>Time-locked</Text>
            </View>
          )}
        </View>

        {/* ── Hero card ── */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <View
            style={{
              backgroundColor: colors.ink,
              borderRadius: radius.sm,
              padding: spacing.lg,
              paddingTop: spacing.xl,
              overflow: 'hidden',
              ...shadow.elevated,
            }}
          >
            {/* Dashed top rule + tab (matches home card style) */}
            <View
              style={{
                borderTopWidth: 1.5,
                borderTopColor: pocketColor,
                borderStyle: 'dashed',
                position: 'absolute',
                top: 14,
                left: 0,
                right: 0,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 16,
                width: 34,
                height: 8,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                backgroundColor: pocketColor,
              }}
            />

            <Text style={{ ...typography.caption, color: colors.surface + 'AA', marginTop: spacing.sm }}>
              Available in this pocket
            </Text>
            <Text
              style={{
                ...typography.display,
                fontSize: 34,
                lineHeight: 42,
                color: colors.surface,
                marginTop: spacing.xs,
                fontVariant: ['tabular-nums'],
              }}
            >
              {fmt(stat?.available ?? 0)}
            </Text>
            <Text style={{ ...typography.caption, color: colors.surface + '88', marginTop: 4 }}>
              of {fmt(stat?.monthly_allocation ?? 0)} monthly allocation · {Math.round(pctRemaining)}% remaining
            </Text>

            {/* Progress bar */}
            <View
              style={{
                height: 6,
                backgroundColor: colors.surface + '22',
                borderRadius: radius.pill,
                marginTop: spacing.lg,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${pctRemaining}%`,
                  backgroundColor: pocketColor,
                  borderRadius: radius.pill,
                }}
              />
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.xl }}>
              <View>
                <Text style={{ ...typography.caption, color: colors.surface + '88' }}>Spent</Text>
                <Text style={{ ...typography.heading, color: colors.surface, fontVariant: ['tabular-nums'] }}>
                  {fmt(stat?.spent ?? 0)}
                </Text>
              </View>
              <View>
                <Text style={{ ...typography.caption, color: colors.surface + '88' }}>Avg/day</Text>
                <Text style={{ ...typography.heading, color: colors.surface, fontVariant: ['tabular-nums'] }}>
                  {fmt(stat?.daily_average_spend ?? 0)}
                </Text>
              </View>
              <View>
                <Text style={{ ...typography.caption, color: colors.surface + '88' }}>Days left</Text>
                <Text style={{ ...typography.heading, color: colors.surface }}>
                  {stat?.days_remaining ?? '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Action buttons ──
            "Add money" used to sit next to "Reallocate" here, but both
            opened the same realloc-pick flow (one pre-filled the
            destination, one didn't) — a distinction with no real
            difference from the user's point of view, and a source of
            confusion. Reallocate now covers both directions from this
            pocket; the destination is preset when there's an obvious one. */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Button
            fullWidth
            leftIcon={<ArrowLeftRight size={16} color={colors.surface} strokeWidth={2} />}
            onPress={() =>
              router.push({ pathname: '/(modals)/realloc-pick', params: { destinationPocketId: id } })
            }
          >
            Reallocate
          </Button>
        </View>

        {/* Log spend button — spendable pockets only, but not if pocket has sub-pockets */}
        {pocket?.kind === 'spendable' && subPockets.length === 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
            <Button
              fullWidth
              variant="secondary"
              leftIcon={<ShoppingCart size={16} color={colors.ink} strokeWidth={2} />}
              onPress={() =>
                router.push({
                  pathname: '/(pockets)/log-spend',
                  params: { pocketId: id, pocketName: pocket.name },
                })
              }
            >
              Log a spend
            </Button>
          </View>
        )}

        {/* Time-lock entry — savings pockets that are locked */}
        {pocket?.is_time_locked && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                backgroundColor: colors.goldTint,
                borderRadius: radius.sm,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderWidth: borderWidth,
                borderColor: colors.gold + '40',
              }}
              onPress={() =>
                router.push({ pathname: '/(security)/time-lock', params: { pocketId: id } })
              }
              accessibilityRole="button"
              accessibilityLabel="Manage time-lock"
            >
              <Lock size={16} color={colors.gold} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.heading, color: colors.gold }}>Manage time-lock</Text>
                {pocket.lock_until && (
                  <Text style={{ ...typography.caption, color: colors.gold + 'CC', marginTop: 2 }}>
                    Locked until {new Date(pocket.lock_until).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                )}
              </View>
              <ArrowLeft size={16} color={colors.gold} style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>
          </View>
        )}

        {/* ── Reallocation frequency friction note ── */}
        {(activity?.reallocation_count ?? 0) >= 3 && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.md,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: spacing.sm,
              backgroundColor: colors.clayTint,
              borderRadius: radius.sm,
              padding: spacing.md,
              borderWidth: borderWidth,
              borderColor: colors.clay + '30',
            }}
          >
            <AlertTriangle size={15} color={colors.clay} strokeWidth={2} style={{ marginTop: 1 }} />
            <Text style={{ ...typography.caption, color: colors.clay, flex: 1, lineHeight: 18 }}>
              You've reallocated from this pocket {activity?.reallocation_count} times this month — more than usual.
            </Text>
          </View>
        )}

        {/* ── Merchant scope — spendable pockets only ── */}
        {pocket?.kind === 'spendable' && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.sm,
                borderWidth: borderWidth,
                borderColor: colors.line,
                padding: spacing.lg,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                <Store size={15} color={colors.ink} strokeWidth={2} />
                <Text style={{ ...typography.eyebrow, color: colors.ink }}>
                  Where this pocket can spend
                </Text>
              </View>

              {scope ? (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {scope.merchant_scope.allowed_categories.map(cat => (
                      <CategoryChip key={cat} label={cat} colors={colors} />
                    ))}
                    {scope.merchant_scope.blocked_categories.map(cat => (
                      <CategoryChip key={cat} label={cat} blocked colors={colors} />
                    ))}
                  </View>
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.sm, lineHeight: 18 }}>
                    Unclassified recipients get asked once, then remembered. Red chips are blocked outright.
                  </Text>
                </>
              ) : (
                <Text style={{ ...typography.caption, color: colors.sage }}>
                  {scopeFailed
                    ? "Couldn't load spending rules for this pocket. Pull to refresh and try again."
                    : 'No merchant rules set yet — all categories are open.'}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Savings protection note — savings pockets ── */}
        {pocket?.kind === 'savings' && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.xl,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: spacing.sm,
              backgroundColor: colors.emeraldTint,
              borderRadius: radius.sm,
              padding: spacing.md,
            }}
          >
            <ShieldCheck size={15} color={colors.emeraldDeep} strokeWidth={2} style={{ marginTop: 1 }} />
            <Text style={{ ...typography.caption, color: colors.emeraldDeep, flex: 1, lineHeight: 18 }}>
              Savings are protected — minimum 10% of income is enforced here. Unspent daily amounts roll over into this pocket at midnight.
            </Text>
          </View>
        )}

        {/* ── Loan information — loan pockets ── */}
        {pocket?.kind === 'loan' && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.xl,
              backgroundColor: colors.plum + '10',
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.plum,
              padding: spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <CircleDollarSign size={18} color={colors.plum} strokeWidth={2} />
              <Text style={{ ...typography.eyebrow, color: colors.ink }}>Loan Details</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>Total Amount</Text>
              <Text style={{ ...typography.body, color: colors.ink }}>
                {formatMoney(pocket.monthly_allocation)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>Status</Text>
              <Text style={{ ...typography.caption, color: colors.plum }}>Active</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>Purpose</Text>
              <Text style={{ ...typography.caption, color: colors.ink }}>
                {pocket.category ? getMerchantCategoryLabel(pocket.category) : 'General purpose'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Sub-pockets (audit_team.md item 10) — top-level pockets only, one level of nesting ── */}
        {pocket && !pocket.parent_pocket_id && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.sm,
                borderWidth: borderWidth,
                borderColor: colors.line,
                padding: spacing.lg,
              }}
            >
              {/* Header row: title + Rebalance (when siblings exist) + Add */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                <Layers size={15} color={colors.ink} strokeWidth={2} />
                <Text style={{ ...typography.eyebrow, color: colors.ink, flex: 1 }}>Sub-pockets</Text>

                {subPockets.length >= 1 && (
                  <Pressable
                    onPress={() => setRebalanceSheetVisible(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 4,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Rebalance sub-pocket splits"
                  >
                    <Sliders size={13} color={colors.emeraldDeep} strokeWidth={2} />
                    <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                      Rebalance
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => router.push({ pathname: '/(modals)/subpocket-create', params: { parentId: id } })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Add sub-pocket"
                >
                  <Plus size={14} color={colors.emeraldDeep} strokeWidth={2.5} />
                  <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                    Add
                  </Text>
                </Pressable>
              </View>

              {/* Always show this section for top-level pockets, even with no sub-pockets yet */}
              {subPockets.length === 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.xs,
                    backgroundColor: colors.emeraldTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Layers size={18} color={colors.emeraldDeep} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.heading, color: colors.ink }}>
                      Create sub-pockets
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                      Split this pocket into smaller portions for specific goals or purposes
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  {/* Split usage bar across all siblings */}
                  {(() => {
                    const totalPct = subPockets.reduce((s, sp) => s + (sp.split_percentage ?? 0), 0);
                    const reserved = Math.max(0, 100 - totalPct);
                    return (
                      <View style={{ marginBottom: spacing.md }}>
                        <View
                          style={{
                            height: 6,
                            backgroundColor: colors.lineSoft,
                            borderRadius: radius.pill,
                            overflow: 'hidden',
                            flexDirection: 'row',
                          }}
                        >
                          {subPockets.map((sp, i) => (
                            <View
                              key={sp.id}
                              style={{
                                height: '100%',
                                width: `${Math.max(0, sp.split_percentage ?? 0)}%`,
                                backgroundColor: i % 2 === 0 ? colors.emeraldDeep : colors.emerald,
                              }}
                            />
                          ))}
                        </View>
                        <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
                          {Math.round(totalPct)}% split across sub-pockets
                          {reserved > 0.5 ? ` · ${Math.round(reserved)}% reserved in parent` : ''}
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Sibling rows */}
                  <View style={{ gap: 0 }}>
                    {subPockets.map((sp) => {
                      const pct = sp.split_percentage ?? 0;
                      return (
                        <View
                          key={sp.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.sm,
                            paddingVertical: spacing.md,
                            borderTopWidth: borderWidth,
                            borderTopColor: colors.lineSoft,
                          }}
                        >
                          {/* Percentage pill */}
                          <View
                            style={{
                              backgroundColor: colors.emeraldTint,
                              borderRadius: radius.pill,
                              paddingHorizontal: spacing.sm,
                              paddingVertical: 2,
                              minWidth: 44,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ ...typography.caption, color: colors.emeraldDeep, fontVariant: ['tabular-nums'] }}>
                              {Math.round(pct)}%
                            </Text>
                          </View>

                          {/* Name + balance */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ ...typography.heading, color: colors.ink }} numberOfLines={1}>
                              {sp.name}
                            </Text>
                            <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                              {fmt(sp.available_balance)} available · {fmt(sp.monthly_allocation)} / mo
                            </Text>
                          </View>

                          {/* Delete */}
                          <Pressable
                            onPress={() => {
                              setDeleteError(null);
                              confirmDeleteSubPocket(sp);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ padding: spacing.xs }}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${sp.name}`}
                          >
                            <Trash2 size={16} color={colors.clay} strokeWidth={2} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* ── Recent activity summary ── */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            Recent activity
          </Text>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.surface,
              borderRadius: radius.sm,
              borderWidth: borderWidth,
              borderColor: colors.line,
              overflow: 'hidden',
            }}
          >
            {[
              { label: 'Transactions', value: activity?.transaction_count ?? 0 },
              { label: 'Reallocations', value: activity?.reallocation_count ?? 0 },
            ].map((item, i) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  borderLeftWidth: i > 0 ? borderWidth : 0,
                  borderLeftColor: colors.lineSoft,
                }}
              >
                <Text style={{ ...typography.caption, color: colors.sage }}>{item.label}</Text>
                <Text style={{ ...typography.title, color: colors.ink, marginTop: 2 }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Transaction history ── */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>
            Transaction history
          </Text>

          {transactions.length === 0 ? (
            <View
              style={{
                padding: spacing.xl,
                borderRadius: radius.sm,
                backgroundColor: colors.surface,
                borderWidth: borderWidth,
                borderColor: colors.line,
                alignItems: 'center',
              }}
            >
              <Wallet size={28} color={colors.sage} strokeWidth={2} />
              <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.md }}>
                No transactions yet
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.sm,
                borderWidth: borderWidth,
                borderColor: colors.line,
                paddingHorizontal: spacing.md,
              }}
            >
              {transactions.map(tx => (
                <TxRow key={tx.id} tx={tx} colors={colors} />
              ))}
              {(hasMore || loadMoreError) && (
                <Pressable
                  onPress={loadMore}
                  disabled={loadingMore}
                  style={{ paddingVertical: spacing.md, alignItems: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel={loadMoreError ? 'Retry loading more transactions' : 'Load more transactions'}
                >
                  {loadingMore ? (
                    <InlineLoading />
                  ) : (
                    <Text style={{ ...typography.caption, color: loadMoreError ? colors.clay : colors.emeraldDeep }}>
                      {loadMoreError ? 'Couldn’t load more — tap to retry' : 'Load more'}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Rebalance bottom sheet — shown when user taps "Rebalance" in the
          sub-pockets section. Uses the first sibling as the anchor pocket id
          (the API resolves the shared parent from any family member). */}
      {pocket && subPockets.length >= 1 && (
        <SubPocketRebalanceSheet
          visible={rebalanceSheetVisible}
          onClose={() => setRebalanceSheetVisible(false)}
          anchorPocketId={subPockets[0].id}
          subPockets={subPockets}
          parentMonthlyAllocation={pocket.monthly_allocation}
          onSuccess={loadAll}
        />
      )}
      {modal}
    </ScreenContainer>
  );
}