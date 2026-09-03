import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, Button } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { msmeStockApi } from '@/services/api';
import { ArrowLeft } from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';

export default function CreateStockScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { alert, modal } = useAlertModal();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [threshold, setThreshold] = useState('5');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name required';
    if (name.trim().length > 100) e.name = 'Max 100';
    if (sku.trim().length > 30) e.sku = 'Max 30';
    const q = Number(qty);
    if (qty.trim() && (isNaN(q) || q < 0)) e.qty = 'Qty ≥0';
    const c = Number(unitCost);
    if (!unitCost.trim() || isNaN(c) || c < 0) e.unitCost = 'Cost ≥0 required';
    const p = Number(unitPrice);
    if (!unitPrice.trim() || isNaN(p) || p < 0) e.unitPrice = 'Price ≥0 required';
    const t = Number(threshold);
    if (threshold.trim() && (isNaN(t) || t < 0)) e.threshold = 'Threshold ≥0';
    if (location.trim().length > 100) e.location = 'Max 100';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: any = {
        name: name.trim(),
        unitCost: Number(unitCost),
        unitPrice: Number(unitPrice),
      };
      if (sku.trim()) payload.sku = sku.trim();
      if (qty.trim()) payload.qtyOnHand = Number(qty);
      if (threshold.trim()) payload.lowStockThreshold = Number(threshold);
      if (location.trim()) payload.location = location.trim();
      const created = await msmeStockApi.create(payload);
      await alert('Stock added', `${created.name} — ${created.qtyOnHand} on hand`);
      router.replace(`/msme-stock/${(created as any).id}` as any);
    } catch (err) {
      await alert('Failed', err instanceof Error ? err.message : 'Could not create item');
    } finally { setLoading(false); }
  };

  const Field = ({ label, value, onChange, placeholder, keyboard, error, hint }: any) => (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ ...typography.caption, color: colors.ink, marginBottom: spacing.xs }}>{label}</Text>
      <TextInput style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: error ? colors.clay : colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.ink }} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.sage} keyboardType={keyboard} autoCapitalize={label.includes('SKU') ? 'characters' : 'words'} />
      {hint ? <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs }}>{hint}</Text> : null}
      {error ? <Text style={{ ...typography.caption, fontSize: 11, color: colors.clay, marginTop: spacing.xs }}>{error}</Text> : null}
    </View>
  );

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
            <Pressable
              onPress={() => safeGoBack(router, '/msme-stock')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: spacing.xs, marginRight: spacing.sm }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
            <Text style={{ ...typography.heading, color: colors.ink }}>Add Stock Item</Text>
          </View>

          <Field label="Name *" value={name} onChange={setName} placeholder="e.g. Cement 50kg" error={errors.name} />
          <Field label="SKU (optional)" value={sku} onChange={setSku} placeholder="CEM50" error={errors.sku} hint="Up to 30 chars, unique per business." />
          <Field label="Qty on hand" value={qty} onChange={setQty} placeholder="0" keyboard="numeric" error={errors.qty} hint="Initial stock. Movements will adjust this." />
          <Field label="Unit cost (KES) *" value={unitCost} onChange={setUnitCost} placeholder="500" keyboard="numeric" error={errors.unitCost} />
          <Field label="Unit price (KES) *" value={unitPrice} onChange={setUnitPrice} placeholder="650" keyboard="numeric" error={errors.unitPrice} />
          <Field label="Low-stock threshold" value={threshold} onChange={setThreshold} placeholder="5" keyboard="numeric" error={errors.threshold} hint="Flagged when qty ≤ threshold." />
          <Field label="Location (optional)" value={location} onChange={setLocation} placeholder="Main store" error={errors.location} />
        </ScrollView>

        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            paddingBottom: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.paper,
          }}
        >
          <Button onPress={submit} loading={loading} disabled={loading}>
            Add Item
          </Button>
        </View>
      </KeyboardAvoidingView>
      {modal}
    </ScreenContainer>
  );
}
