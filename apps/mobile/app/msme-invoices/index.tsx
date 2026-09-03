import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, LoadingState, ErrorState, Button, SearchBar } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { msmeInvoicesApi } from '@/services/api';
import { formatMoney } from '@/utils/money';
import { Plus, Receipt, AlertTriangle, Check, Clock } from 'lucide-react-native';

type Invoice = {
  id: string;
  customerName: string;
  customerPin?: string | null;
  amount: number;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'void';
  description?: string | null;
  isOverdue?: boolean;
};

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'void' | 'overdue';

export default function MsmeInvoicesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { modal } = useAlertModal();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<{ total: number; draft: number; sent: number; paid: number; voidCount: number; overdue: number; outstanding: number; overdueAmount: number; paidAmount: number } | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (reset = true) => {
    try {
      if (reset) setError(null);
      const pageToLoad = reset ? 1 : page;
      const res: any = await msmeInvoicesApi.getAll(
        statusFilter === 'overdue'
          ? { overdue: true, page: pageToLoad, limit: 20, search: searchQuery || undefined } as any
          : statusFilter === 'all'
            ? { page: pageToLoad, limit: 20, search: searchQuery || undefined } as any
            : { status: statusFilter, page: pageToLoad, limit: 20, search: searchQuery || undefined } as any,
      );
      // Normalize: backend returns array when page not set, paginated object when set
      const isPaginated = res && typeof res === 'object' && 'data' in res;
      const data = isPaginated ? (res.data as Invoice[]) : (res as Invoice[]);
      const totalPages = isPaginated ? res.totalPages : 1;
      if (reset) {
        setInvoices(data);
        setPage(1);
        setHasMore(totalPages > 1);
      } else {
        setInvoices(prev => [...prev, ...data]);
        setHasMore(pageToLoad < totalPages);
      }
      const s = await msmeInvoicesApi.getStats().catch(() => null);
      if (s) setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLoadingMore(false);
    }
  }, [statusFilter, searchQuery, page]);

  const initialLoad = useCallback(async () => {
    setIsLoading(true);
    setPage(1);
    try {
      setError(null);
      const res: any = await msmeInvoicesApi.getAll(
        statusFilter === 'overdue'
          ? { overdue: true, page: 1, limit: 20, search: searchQuery || undefined } as any
          : statusFilter === 'all'
            ? { page: 1, limit: 20, search: searchQuery || undefined } as any
            : { status: statusFilter, page: 1, limit: 20, search: searchQuery || undefined } as any,
      );
      const isPaginated = res && typeof res === 'object' && 'data' in res;
      const data = isPaginated ? (res.data as Invoice[]) : (res as Invoice[]);
      const totalPages = isPaginated ? res.totalPages : 1;
      setInvoices(data);
      setHasMore(totalPages > 1);
      setPage(1);
      const s = await msmeInvoicesApi.getStats().catch(() => null);
      if (s) setStats(s as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  React.useEffect(() => { initialLoad(); }, [initialLoad]);
  useFocusEffect(useCallback(() => { initialLoad(); }, [initialLoad]));

  const onRefresh = async () => {
    setIsRefreshing(true);
    await initialLoad();
    setIsRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    try {
      const res: any = await msmeInvoicesApi.getAll(
        statusFilter === 'overdue'
          ? { overdue: true, page: next, limit: 20, search: searchQuery || undefined } as any
          : statusFilter === 'all'
            ? { page: next, limit: 20, search: searchQuery || undefined } as any
            : { status: statusFilter, page: next, limit: 20, search: searchQuery || undefined } as any,
      );
      const isPaginated = res && typeof res === 'object' && 'data' in res;
      const data = isPaginated ? (res.data as Invoice[]) : (res as Invoice[]);
      const totalPages = isPaginated ? res.totalPages : 1;
      setInvoices(prev => [...prev, ...data]);
      setHasMore(next < totalPages);
    } catch {}
    setLoadingMore(false);
  };

  const getBadge = (inv: Invoice) => {
    if (inv.isOverdue) return { bg: colors.clayTint, text: colors.clay, label: 'Overdue' };
    const map: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: colors.goldTint, text: colors.gold, label: 'Draft' },
      sent: { bg: colors.emeraldTint, text: colors.emeraldDeep, label: 'Sent' },
      paid: { bg: colors.emeraldTint, text: colors.emeraldDeep, label: 'Paid' },
      void: { bg: colors.lineSoft, text: colors.sage, label: 'Void' },
    };
    return map[inv.status] || map.draft;
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}><Text style={{ ...typography.title, color: colors.ink }}>Invoices</Text></View>
        <LoadingState label="Loading invoices…" variant="loans" />
      </ScreenContainer>
    );
  }

  const header = (
    <View style={{ paddingBottom: spacing.md }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ ...typography.title, color: colors.ink }}>Invoices</Text>
        <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>Track receivables — eTIMS-ready. Mark paid to allocate to MSME pockets.</Text>
      </View>

      {stats && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.sage }}>Outstanding</Text>
            <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 }}>{formatMoney(stats.outstanding)}</Text>
            <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>{stats.total - stats.paid - stats.voidCount} open</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: stats.overdue > 0 ? colors.clayTint : colors.surface, borderWidth: 1, borderColor: stats.overdue > 0 ? colors.clay : colors.line, borderRadius: radius.md, padding: spacing.md }}>
            <Text style={{ ...typography.caption, color: stats.overdue > 0 ? colors.clay : colors.sage }}>Overdue</Text>
            <Text style={{ ...typography.heading, color: stats.overdue > 0 ? colors.clay : colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 }}>{stats.overdue}</Text>
            <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>{formatMoney(stats.overdueAmount)}</Text>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search customer…" onClear={() => setSearchQuery('')} />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={(['all', 'draft', 'sent', 'paid', 'void', 'overdue'] as StatusFilter[])}
          keyExtractor={f => f}
          renderItem={({ item: f }) => (
            <Pressable key={f} onPress={() => setStatusFilter(f)} style={({ pressed }) => [{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: statusFilter === f ? colors.emeraldDeep : colors.surface, borderWidth: 1, borderColor: statusFilter === f ? colors.emeraldDeep : colors.line, marginRight: spacing.xs }, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button" accessibilityState={{ selected: statusFilter === f }} accessibilityLabel={`Filter ${f}`}>
              <Text style={{ ...typography.caption, color: statusFilter === f ? colors.surface : colors.ink, textTransform: 'capitalize' }}>{f}</Text>
            </Pressable>
          )}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <Button fullWidth leftIcon={<Plus size={16} color={colors.surface} strokeWidth={2} />} onPress={() => router.push('/msme-invoices/create' as any)}>New Invoice</Button>
      </View>

      {error && <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}><ErrorState message={error} onRetry={onRefresh} /></View>}

      {!error && invoices.length === 0 && (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}><Receipt size={32} color={colors.gold} strokeWidth={2} /></View>
          <Text style={{ ...typography.heading, color: colors.sage }}>No invoices</Text>
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, textAlign: 'center' }}>Create an invoice for a customer. Sent invoices can be marked paid to allocate to your MSME pockets.</Text>
        </View>
      )}
    </View>
  );

  const renderItem = ({ item: inv }: { item: Invoice }) => {
    const badge = getBadge(inv);
    return (
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Pressable onPress={() => router.push(`/msme-invoices/${inv.id}` as any)} style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: inv.isOverdue ? colors.clay : colors.line, opacity: pressed ? 0.8 : 1 })} accessibilityRole="button" accessibilityLabel={`${inv.customerName} ${formatMoney(inv.amount)} ${inv.status}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }} numberOfLines={1}>{inv.customerName}</Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>{inv.description || 'No note'} · Due {inv.dueDate}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: badge.bg, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
              {inv.isOverdue ? <AlertTriangle size={12} color={badge.text} /> : inv.status === 'paid' ? <Check size={12} color={badge.text} /> : inv.status === 'sent' ? <Clock size={12} color={badge.text} /> : null}
              <Text style={{ ...typography.caption, fontSize: 10, color: badge.text, textTransform: 'capitalize' }}>{badge.label}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatMoney(inv.amount)}</Text>
            {inv.customerPin ? <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>PIN {inv.customerPin}</Text> : null}
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <FlatList
        data={invoices}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={hasMore ? <View style={{ padding: spacing.lg, alignItems: 'center' }}><Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.sm }}>{loadingMore ? 'Loading…' : `${invoices.length} invoices`}</Text>{hasMore && <Button variant="ghost" onPress={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Button>}</View> : null}
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.emeraldDeep} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        initialNumToRender={10}
        windowSize={5}
        removeClippedSubviews
      />
      {modal}
    </ScreenContainer>
  );
}
