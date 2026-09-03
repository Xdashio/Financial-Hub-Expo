import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, LoadingState, ErrorState, Button, SearchBar } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { msmeStockApi } from '@/services/api';
import { formatMoney } from '@/utils/money';
import { Plus, Package, AlertTriangle, TrendingUp, Check } from 'lucide-react-native';

type StockItem = {
  id: string;
  name: string;
  sku?: string | null;
  qtyOnHand: number;
  unitCost: number;
  unitPrice: number;
  lowStockThreshold: number;
  isLowStock?: boolean;
  location?: string | null;
};

export default function MsmeStockScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { modal } = useAlertModal();

  const [items, setItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<{ totalItems: number; lowStock: number; outOfStock: number; totalValueCost: number; totalValuePrice: number; potentialMargin: number } | null>(null);

  const initialLoad = useCallback(async () => {
    try {
      setError(null);
      const res: any = await msmeStockApi.getAll({ search: searchQuery || undefined, lowStock: lowOnly || undefined, page: 1, limit: 20 } as any);
      const isPaginated = res && typeof res === 'object' && 'data' in res;
      const data = isPaginated ? (res.data as StockItem[]) : (res as StockItem[]);
      const totalPages = isPaginated ? res.totalPages : 1;
      setItems(data);
      setHasMore(totalPages > 1);
      setPage(1);
      const s = await msmeStockApi.getStats().catch(() => null);
      if (s) setStats(s as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stock');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, lowOnly]);

  React.useEffect(() => { initialLoad(); }, [initialLoad]);
  useFocusEffect(useCallback(() => { initialLoad(); }, [initialLoad]));

  const onRefresh = async () => { setIsRefreshing(true); await initialLoad(); };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    try {
      const res: any = await msmeStockApi.getAll({ search: searchQuery || undefined, lowStock: lowOnly || undefined, page: next, limit: 20 } as any);
      const isPaginated = res && typeof res === 'object' && 'data' in res;
      const data = isPaginated ? (res.data as StockItem[]) : (res as StockItem[]);
      const totalPages = isPaginated ? res.totalPages : 1;
      setItems(prev => [...prev, ...data]);
      setHasMore(next < totalPages);
    } catch {}
    setLoadingMore(false);
  };

  if (isLoading) {
    return <ScreenContainer><View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}><Text style={{ ...typography.title, color: colors.ink }}>Stock</Text></View><LoadingState label="Loading stock…" variant="loans" /></ScreenContainer>;
  }

  const header = (
    <View style={{ paddingBottom: spacing.md }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ ...typography.title, color: colors.ink }}>Stock & Inventory</Text>
        <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>Track qty on hand — low-stock flagged, out/in adjusts ledger.</Text>
      </View>

      {stats && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.sage }}>Items</Text>
            <Text style={{ ...typography.heading, color: colors.ink, marginTop: 2 }}>{stats.totalItems}</Text>
            <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>{stats.lowStock} low · {stats.outOfStock} out</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.sage }}>Value (cost)</Text>
            <Text style={{ ...typography.heading, color: colors.ink, marginTop: 2, fontVariant: ['tabular-nums'] }}>{formatMoney(stats.totalValueCost)}</Text>
            <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>margin {formatMoney(stats.potentialMargin)}</Text>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md, gap: spacing.sm }}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search name, SKU…" onClear={() => setSearchQuery('')} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable onPress={() => setLowOnly(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: lowOnly ? colors.clay : colors.surface, borderWidth: 1, borderColor: lowOnly ? colors.clay : colors.line }} accessibilityRole="button" accessibilityState={{ selected: lowOnly }} accessibilityLabel={lowOnly ? 'Showing low stock only' : 'Show low stock only'}>
            {lowOnly ? <Check size={12} color={colors.surface} strokeWidth={2} /> : null}
            <Text style={{ ...typography.caption, color: lowOnly ? colors.surface : colors.ink }}>{lowOnly ? 'Low stock only' : 'Low stock only'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <Button fullWidth leftIcon={<Plus size={16} color={colors.surface} strokeWidth={2} />} onPress={() => router.push('/msme-stock/create' as any)}>Add Item</Button>
      </View>

      {error && <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}><ErrorState message={error} onRetry={onRefresh} /></View>}

      {!error && items.length === 0 && (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}><Package size={32} color={colors.gold} strokeWidth={2} /></View>
          <Text style={{ ...typography.heading, color: colors.sage }}>No stock items</Text>
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, textAlign: 'center' }}>Add your first item (e.g. Cement 50kg, SKU CEM50, cost 500, price 650).</Text>
        </View>
      )}
    </View>
  );

  const renderItem = ({ item }: { item: StockItem }) => {
    const low = item.isLowStock || item.qtyOnHand <= item.lowStockThreshold;
    const out = item.qtyOnHand === 0;
    return (
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Pressable onPress={() => router.push(`/msme-stock/${item.id}` as any)} style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: low ? colors.clay : colors.line, opacity: pressed ? 0.8 : 1 })} accessibilityRole="button" accessibilityLabel={`${item.name} ${item.qtyOnHand} in stock`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }} numberOfLines={1}>{item.name}</Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>{item.sku || 'No SKU'} {item.location ? `· ${item.location}` : ''}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: out ? colors.clayTint : low ? colors.goldTint : colors.emeraldTint, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill }} accessibilityRole="text" accessibilityLabel={out ? 'Out of stock' : low ? 'Low stock' : `${item.qtyOnHand} in stock`}>
              {low ? <AlertTriangle size={12} color={out ? colors.clay : colors.gold} /> : <TrendingUp size={12} color={colors.emeraldDeep} />}
              <Text style={{ ...typography.caption, fontSize: 10, color: out ? colors.clay : low ? colors.gold : colors.emeraldDeep }}>{out ? 'Out' : low ? 'Low' : `${item.qtyOnHand} in stock`}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{item.qtyOnHand} × {formatMoney(item.unitPrice)}</Text>
            <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>cost {formatMoney(item.unitCost)}</Text>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={hasMore ? <View style={{ padding: spacing.lg, alignItems: 'center' }}><Button variant="ghost" onPress={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Button></View> : null}
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
