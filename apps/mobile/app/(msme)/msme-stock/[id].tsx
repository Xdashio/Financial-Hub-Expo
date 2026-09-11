import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, LoadingState, ErrorState, Button } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { msmeStockApi, createIdempotencyKey } from '@/services/api';
import { formatMoney } from '@/utils/money';
import { ArrowLeft } from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';

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

  const move = async (action: 'in' | 'out' | 'adjust') => {
    const rawN = Number(qty);
    if (!qty || isNaN(rawN) || rawN === 0) { await alert('Invalid qty', 'Enter a non-zero qty'); return; }
    const delta = action === 'adjust' ? -Math.abs(rawN) : Math.abs(rawN);
    const needed = Math.abs(delta);

    if ((action === 'out' || action === 'adjust') && item && needed > item.qtyOnHand) {
      await alert('Insufficient stock', `Have ${item.qtyOnHand}, tried to ${action === 'out' ? 'remove' : 'adjust'} ${needed}`);
      return;
    }
    setActing(action);
    try {
      const key = createIdempotencyKey(`stock_${action}`);
      const payloadQty = action === 'adjust' ? -Math.abs(rawN) : needed;
      const res = await msmeStockApi.move(id!, {
        type: action,
        qty: payloadQty,
        note: note.trim() || (action === 'adjust' ? 'Shrinkage / Spoilage' : undefined),
      } as any, key);
      setItem(res.item as Item);
      setMovements(await msmeStockApi.getMovements(id!) as Movement[]);
      setQty(''); setNote('');
      const actionText = action === 'in' ? `Added ${needed}` : action === 'out' ? `Removed ${needed}` : `Adjusted -${needed} (shrinkage)`;
      await alert('Done', `${actionText} -- now ${res.item.qtyOnHand} on hand`);
    } catch (e) {
      await alert('Failed', e instanceof Error ? e.message : String(e));
    } finally { setActing(null); }
  };

  if (loading) return <ScreenContainer><LoadingState label="Loading item..." variant="stock-detail" /></ScreenContainer>;
  if (error || !item) return <ScreenContainer><ErrorState message={error || 'Not found'} onRetry={load} /></ScreenContainer>;

  const low = item.isLowStock || item.qtyOnHand <= item.lowStockThreshold;
  const out = item.qtyOnHand === 0;

  return (
    <ScreenContainer>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl * 1.2 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.emeraldDeep} />}>
        <Pressable
          onPress={() => safeGoBack(router, '/msme-stock')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, padding: spacing.xs, alignSelf: 'flex-start' }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
        </Pressable>

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
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>cost {formatMoney(item.unitCost)} to price {formatMoney(item.unitPrice)}</Text>
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
              <TextInput style={{ backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.ink }} value={note} onChangeText={setNote} placeholder="e.g. Delivery or shrinkage" placeholderTextColor={colors.sage} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}><Button fullWidth variant="secondary" onPress={() => move('in')} loading={acting === 'in'}>Stock In (+)</Button></View>
            <View style={{ flex: 1 }}><Button fullWidth variant="primary" onPress={() => move('out')} loading={acting === 'out'}>Stock Out (-)</Button></View>
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <Button fullWidth variant="ghost" onPress={() => move('adjust')} loading={acting === 'adjust'}>Log Shrinkage / Spoilage (-)</Button>
          </View>
          <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.sm, lineHeight: 14 }}>In adds qty, Out logs sales, Shrinkage logs lost or spoiled items. Each movement is ledgered.</Text>
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
                  <Text style={{ ...typography.caption, color: m.type === 'in' ? colors.emeraldDeep : m.type === 'out' ? colors.clay : colors.gold, fontWeight: '700', textTransform: 'uppercase', fontSize: 11 }}>{m.type} · {m.qty}</Text>
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
