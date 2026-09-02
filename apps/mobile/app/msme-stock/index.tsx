import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, LoadingState, ErrorState, Button } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { msmeStockApi } from '@/services/api';
import { formatMoney } from '@/utils/money';
import { Plus, Package, AlertTriangle, TrendingUp } from 'lucide-react-native';

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
  const [stats, setStats] = useState<{ totalItems: number; lowStock: number; outOfStock: number; totalValueCost: number; totalValuePrice: number; potentialMargin: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, s] = await Promise.all([
        msmeStockApi.getAll({ search: searchQuery || undefined, lowStock: lowOnly || undefined }),
        msmeStockApi.getStats().catch(() => null),
      ]);
      setItems(data as StockItem[]);
      if (s) setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stock');
    } finally { setIsLoading(false); }
  }, [searchQuery, lowOnly]);

  React.useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setIsRefreshing(true); await load(); setIsRefreshing(false); };

  if (isLoading) {
    return <ScreenContainer><View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}><Text style={{ ...typography.title, color: colors.ink }}>Stock</Text></View><LoadingState label="Loading stock…" variant="loans" /></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.emeraldDeep} />}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md }}>
            <Text style={{ color: colors.sage }}>🔍</Text>
            <TextInput style={{ flex: 1, ...typography.body, color: colors.ink, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm }} placeholder="Search name, SKU…" value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor={colors.sage} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable onPress={() => setLowOnly(v => !v)} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: lowOnly ? colors.clay : colors.surface, borderWidth: 1, borderColor: lowOnly ? colors.clay : colors.line }}>
              <Text style={{ ...typography.caption, color: lowOnly ? colors.surface : colors.ink }}>{lowOnly ? 'Low stock only ✓' : 'Low stock only'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Button fullWidth leftIcon={<Plus size={16} color={colors.surface} strokeWidth={2} />} onPress={() => router.push('/msme-stock/create' as any)}>Add Item</Button>
        </View>

        {error && <View style={{ paddingHorizontal: spacing.lg }}><ErrorState message={error} onRetry={onRefresh} /></View>}

        {!error && items.length === 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, alignItems: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}><Package size={32} color={colors.gold} strokeWidth={2} /></View>
            <Text style={{ ...typography.heading, color: colors.sage }}>No stock items</Text>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, textAlign: 'center' }}>Add your first item (e.g. Cement 50kg, SKU CEM50, cost 500, price 650).</Text>
          </View>
        )}

        {!error && items.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            {items.map(item => {
              const low = item.isLowStock || item.qtyOnHand <= item.lowStockThreshold;
              const out = item.qtyOnHand === 0;
              return (
                <Pressable key={item.id} onPress={() => router.push(`/msme-stock/${item.id}` as any)} style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: low ? colors.clay : colors.line, opacity: pressed ? 0.8 : 1 })} accessibilityRole="button">
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.heading, color: colors.ink }} numberOfLines={1}>{item.name}</Text>
                      <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>{item.sku || 'No SKU'} {item.location ? `· ${item.location}` : ''}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: out ? colors.clayTint : low ? colors.goldTint : colors.emeraldTint, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
                      {low ? <AlertTriangle size={12} color={out ? colors.clay : colors.gold} /> : <TrendingUp size={12} color={colors.emeraldDeep} />}
                      <Text style={{ ...typography.caption, fontSize: 10, color: out ? colors.clay : low ? colors.gold : colors.emeraldDeep }}>{out ? 'Out' : low ? 'Low' : `${item.qtyOnHand} in stock`}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{item.qtyOnHand} × {formatMoney(item.unitPrice)}</Text>
                    <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>cost {formatMoney(item.unitCost)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}
