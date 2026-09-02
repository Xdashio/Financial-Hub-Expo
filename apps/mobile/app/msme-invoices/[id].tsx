import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, LoadingState, ErrorState, Button } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { msmeInvoicesApi } from '@/services/api';
import { formatMoney } from '@/utils/money';

type Invoice = {
  id: string;
  customerName: string;
  customerPin?: string | null;
  amount: number;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'void';
  description?: string | null;
  etimsStatus?: string | null;
  paidAt?: string | null;
  isOverdue?: boolean;
};

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { alert, modal } = useAlertModal();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await msmeInvoicesApi.getById(id);
      setInvoice(data as Invoice);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn: () => Promise<unknown>, label: string) => {
    setActing(label);
    try { await fn(); await load(); } catch (e) { await alert('Failed', e instanceof Error ? e.message : String(e)); } finally { setActing(null); }
  };

  if (loading) return <ScreenContainer><LoadingState label="Loading invoice…" variant="loans" /></ScreenContainer>;
  if (error || !invoice) return <ScreenContainer><ErrorState message={error || 'Not found'} onRetry={load} /></ScreenContainer>;

  const canSend = invoice.status === 'draft';
  const canPay = invoice.status === 'draft' || invoice.status === 'sent';
  const canVoid = invoice.status === 'draft' || invoice.status === 'sent';
  const isPaid = invoice.status === 'paid';
  const isOverdue = invoice.isOverdue;

  return (
    <ScreenContainer>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl * 1.2 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.emeraldDeep} />}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }}><Text style={{ ...typography.body, color: colors.emeraldDeep }}>‹ Back</Text></Pressable>

        <View style={{ backgroundColor: isOverdue ? colors.clayTint : colors.surface, borderWidth: 1, borderColor: isOverdue ? colors.clay : colors.line, borderRadius: radius.lg, padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.title, color: colors.ink }}>{invoice.customerName}</Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>{invoice.description || 'No description'}</Text>
            </View>
            <View style={{ backgroundColor: isPaid ? colors.emeraldTint : isOverdue ? colors.clay : invoice.status === 'sent' ? colors.emeraldTint : invoice.status === 'draft' ? colors.goldTint : colors.lineSoft, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
              <Text style={{ ...typography.caption, fontSize: 11, color: isPaid || invoice.status === 'sent' ? colors.emeraldDeep : isOverdue ? colors.clay : colors.sage, textTransform: 'capitalize' }}>{isOverdue ? 'Overdue' : invoice.status}</Text>
            </View>
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.sage }}>Amount</Text>
            <Text style={{ ...typography.display, fontSize: 28, color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 }}>{formatMoney(invoice.amount)}</Text>
            <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 2 }}>Due {invoice.dueDate} {isOverdue ? '· overdue' : ''}</Text>
          </View>

          <View style={{ height: 1, backgroundColor: colors.lineSoft, marginTop: spacing.lg, marginBottom: spacing.lg }} />

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ ...typography.caption, color: colors.sage }}>KRA PIN</Text><Text style={{ ...typography.caption, color: colors.ink }}>{invoice.customerPin || '—'}</Text></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ ...typography.caption, color: colors.sage }}>eTIMS</Text><Text style={{ ...typography.caption, color: colors.ink }}>{invoice.etimsStatus || '—'}</Text></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ ...typography.caption, color: colors.sage }}>ID</Text><Text style={{ ...typography.caption, color: colors.sage, fontSize: 11 }}>{invoice.id.slice(0, 8)}…</Text></View>
          </View>
        </View>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {canSend && <Button fullWidth variant="secondary" onPress={() => act(() => msmeInvoicesApi.send(invoice.id), 'send')} loading={acting === 'send'}>Send to Customer</Button>}
          {canPay && <Button fullWidth onPress={() => act(() => msmeInvoicesApi.pay(invoice.id), 'pay')} loading={acting === 'pay'}>Mark Paid — Allocate to MSME Pockets</Button>}
          {canVoid && <Button fullWidth variant="ghost" onPress={() => Alert.alert('Void invoice?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Void', style: 'destructive', onPress: () => act(() => msmeInvoicesApi.void(invoice.id), 'void') }])} loading={acting === 'void'}>Void</Button>}
          {invoice.status !== 'paid' && <Button fullWidth variant="ghost" onPress={() => Alert.alert('Delete?', 'Delete this draft?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await msmeInvoicesApi.delete(invoice.id); router.replace('/msme-invoices' as any); } catch (e) { await alert('Failed', e instanceof Error ? e.message : String(e)); } } }])}>Delete</Button>}
        </View>

        <View style={{ marginTop: spacing.lg, backgroundColor: colors.emeraldTint, borderRadius: radius.md, padding: spacing.md }}>
          <Text style={{ ...typography.caption, color: colors.ink, lineHeight: 16 }}>Paying allocates <Text style={{ fontWeight: '700' }}>{formatMoney(invoice.amount)}</Text> proportionally to your MSME pockets (like manual income, segment=msme). Check <Text style={{ fontWeight: '700' }}>Business pockets</Text> after paying.</Text>
        </View>
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}
