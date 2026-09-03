import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, LoadingState, ErrorState, Button } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { msmeStockApi, createIdempotencyKey } from '@/services/api';
import { formatMoney } from '@/utils/money';

type Item = {
  id: string; name: string; sku?: string | null; qtyOnHand: number; unitCost: number; unitPrice: number; lowStockThreshold: number; isLowStock?: boolean; location?: string | null;
};
type Movement = { id: string; type: 'in' | 'out' | 'adjust'; qty: number; unitCost?: number | null; totalCost: number; note?: string | null; createdAt: string };

export default function StockDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { alert, confirm, modal } = useAlertModal();

  const [item, setItem] = useState<Item | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const [it, movs] = await Promise.all([msmeStockApi.getById(id), msmeStockApi.getMovements(id)]);
      setItem(it as Item);
      setMovements(movs as Movement[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const move = async (type: 'in' | 'out') => {
    const n = Number(qty);
    if (!qty || isNaN(n) || n <= 0) { await alert('Invalid qty', 'Enter qty > 0'); return; }
    if (type === 'out' && item && n > item.qtyOnHand) { await alert('Insufficient stock', `Have ${item.qtyOnHand}, tried ${n}`); return; }
    setActing(type);
    try {
      const key = createIdempotencyKey(`stock_${type}`);
      const res = await msmeStockApi.move(id!, { type, qty: n, note: note.trim() || undefined } as any, key);
      setItem(res.item as Item);
      setMovements(await msmeStockApi.getMovements(id!) as Movement[]);
      setQty(''); setNote('');
      await alert('Done', `${type === 'in' ? 'Added' : 'Removed'} ${n} — now ${res.item.qtyOnHand} on hand`);
    } catch (e) {
      await alert('Failed', e instanceof Error ? e.message : String(e));
    } finally { setActing(null); }
  };

  if (loading) return <ScreenContainer><LoadingState label="Loading item…" variant="loans" /></ScreenContainer>;
  if (error || !item) return <ScreenContainer><ErrorState message={error || 'Not found'} onRetry={load} /></ScreenContainer>;

  const low = item.isLowStock || item.qtyOnHand <= item.lowStockThreshold;
  const out = item.qtyOnHand === 0;

  return (
    <ScreenContainer>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl * 1.2 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.emeraldDeep} />}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }}><Text style={{ ...typography.body, color: colors.emeraldDeep }}>‹ Back</Text></Pressable>

        <View style={{ backgroundColor: low ? colors.clayTint : colors.surface, borderWidth: 1, borderColor: low ? colors.clay : colors.line, borderRadius: radius.lg, padding: spacing.lg }}>
          <Text style={{ ...typography.title, color: colors.ink }}>{item.name}</Text>
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>{item.sku || 'No SKU'} {item.location ? `· ${item.location}` : ''}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
            <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>On hand</Text>
              <Text style={{ ...typography.display, color: out ? colors.clay : low ? colors.gold : colors.ink, fontSize: 28, marginTop: 2 }}>{item.qtyOnHand}</Text>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>threshold {item.lowStockThreshold}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>Margin</Text>
              <Text style={{ ...typography.heading, color: colors.ink, marginTop: 2, fontVariant: ['tabular-nums'] }}>{formatMoney((item.unitPrice - item.unitCost) * item.qtyOnHand)}</Text>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>cost {formatMoney(item.unitCost)} → price {formatMoney(item.unitPrice)}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg }}>
          <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.md }}>Adjust stock</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.caption, color: colors.ink, marginBottom: spacing.xs }}>Qty</Text>
              <TextInput style={{ backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.ink }} value={qty} onChangeText={setQty} placeholder="e.g. 5" keyboardType="numeric" placeholderTextColor={colors.sage} />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={{ ...typography.caption, color: colors.ink, marginBottom: spacing.xs }}>Note</Text>
              <TextInput style={{ backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.ink }} value={note} onChangeText={setNote} placeholder="e.g. Delivery from supplier" placeholderTextColor={colors.sage} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}><Button fullWidth variant="secondary" onPress={() => move('in')} loading={acting === 'in'}>Stock In (+)</Button></View>
            <View style={{ flex: 1 }}><Button fullWidth variant="primary" onPress={() => move('out')} loading={acting === 'out'}>Stock Out (–)</Button></View>
          </View>
          <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.sm, lineHeight: 14 }}>In adds qty, Out guards qty (cannot go negative). Each movement is ledgered.</Text>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.md }}>Movements ({movements.length})</Text>
          {movements.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>No movements yet</Text>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs }}>Stock-in on create + your adjustments will appear here.</Text>
            </View>
          ) : (
            movements.map(m => (
              <View key={m.id} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.caption, color: m.type === 'in' ? colors.emeraldDeep : m.type === 'out' ? colors.clay : colors.sage, fontWeight: '700', textTransform: 'uppercase', fontSize: 11 }}>{m.type} · {m.qty}</Text>
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2, fontSize: 11 }}>{new Date(m.createdAt).toLocaleString()} {m.note ? `· ${m.note}` : ''}</Text>
                </View>
                <Text style={{ ...typography.caption, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatMoney(m.totalCost)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Button fullWidth variant="ghost" onPress={async () => { const ok = await confirm('Delete item?', 'Only if qty is 0. This deletes movements too.', { confirmLabel: 'Delete', destructive: true }); if (!ok) return; try { await msmeStockApi.delete(item.id); router.replace('/msme-stock' as any); } catch (e) { await alert('Failed', e instanceof Error ? e.message : String(e)); } }}>Delete Item</Button>
        </View>
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}
