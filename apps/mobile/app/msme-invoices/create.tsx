import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, Button } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { msmeInvoicesApi } from '@/services/api';

export default function CreateInvoiceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { alert, modal } = useAlertModal();

  const [customerName, setCustomerName] = useState('');
  const [customerPin, setCustomerPin] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!customerName.trim()) e.customerName = 'Customer name required';
    if (customerName.trim().length > 100) e.customerName = 'Max 100 chars';
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Amount must be > 0';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) e.dueDate = 'Use YYYY-MM-DD';
    if (customerPin.trim() && !/^[A-Z][0-9]{9}[A-Z]$/.test(customerPin.trim().toUpperCase())) e.customerPin = 'KRA PIN: A + 9 digits + A (e.g. P051234567A)';
    if (description.trim().length > 200) e.description = 'Max 200 chars';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: any = {
        customerName: customerName.trim(),
        amount: Number(amount),
        dueDate,
      };
      if (customerPin.trim()) payload.customerPin = customerPin.trim().toUpperCase();
      if (description.trim()) payload.description = description.trim();
      const created = await msmeInvoicesApi.create(payload);
      await alert('Invoice created', `${created.customerName} · KES ${created.amount} due ${created.dueDate}`);
      router.replace(`/msme-invoices/${(created as any).id}` as any);
    } catch (err) {
      await alert('Failed', err instanceof Error ? err.message : 'Could not create invoice');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, value, onChange, placeholder, keyboard, error, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; keyboard?: any; error?: string; hint?: string }) => (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ ...typography.caption, color: colors.ink, marginBottom: spacing.xs }}>{label}</Text>
      <TextInput style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: error ? colors.clay : colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.ink }} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.sage} keyboardType={keyboard} autoCapitalize={label.includes('PIN') ? 'characters' : 'words'} />
      {hint ? <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs }}>{hint}</Text> : null}
      {error ? <Text style={{ ...typography.caption, fontSize: 11, color: colors.clay, marginTop: spacing.xs }}>{error}</Text> : null}
    </View>
  );

  return (
    <ScreenContainer>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <Pressable onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ ...typography.body, color: colors.emeraldDeep }}>Cancel</Text></Pressable>
          <Text style={{ ...typography.heading, color: colors.ink }}>New Invoice</Text>
          <View style={{ width: 60 }} />
        </View>

        <Field label="Customer name *" value={customerName} onChange={setCustomerName} placeholder="e.g. Wanjiku Supplies" error={errors.customerName} />
        <Field label="KRA PIN (optional, eTIMS-ready)" value={customerPin} onChange={setCustomerPin} placeholder="P051234567A" error={errors.customerPin} hint="11 chars: letter + 9 digits + letter. Leave blank for non-KRA customers." />
        <Field label="Amount (KES) *" value={amount} onChange={setAmount} placeholder="e.g. 45000" keyboard="numeric" error={errors.amount} />
        <Field label="Due date (YYYY-MM-DD) *" value={dueDate} onChange={setDueDate} placeholder="YYYY-MM-DD" error={errors.dueDate} hint="Overdue = due date < today and status draft/sent." />
        <Field label="Description (optional)" value={description} onChange={setDescription} placeholder="e.g. 50 bags cement, delivery 12th" error={errors.description} />

        <View style={{ backgroundColor: colors.emeraldTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
          <Text style={{ ...typography.caption, color: colors.ink, lineHeight: 16 }}>Draft invoices can be sent to the customer, then marked <Text style={{ fontWeight: '700' }}>Paid</Text> — paid amount is allocated to your MSME pockets like manual income (ledger + allocation).</Text>
        </View>

        <Button fullWidth onPress={submit} loading={loading} disabled={loading}>Create Draft</Button>
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}
