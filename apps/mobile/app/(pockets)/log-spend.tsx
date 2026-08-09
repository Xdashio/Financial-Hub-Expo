import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { spendApi } from '@/services/api';
import { ArrowLeft, ShoppingCart } from 'lucide-react-native';

const CATEGORIES: { id: string; name: string }[] = [
  { id: '', name: "Don't know yet" },
  { id: 'grocery', name: 'Groceries' },
  { id: 'landlord_rent', name: 'Rent' },
  { id: 'utility', name: 'Utilities' },
  { id: 'transport', name: 'Transport' },
  { id: 'healthcare', name: 'Healthcare' },
  { id: 'education', name: 'Education' },
  { id: 'entertainment', name: 'Entertainment' },
  { id: 'gambling_betting', name: 'Betting & gambling' },
  { id: 'personal_care', name: 'Personal care' },
  { id: 'other', name: 'Other' },
];

export default function LogSpendScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert, modal } = useAlertModal();
  const { pocketId, pocketName } = useLocalSearchParams<{ pocketId: string; pocketName: string }>();

  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatAmountInput = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, '');
    if (!cleaned) return '';
    return Number(cleaned).toLocaleString();
  };

  const numericAmount = Number(amount.replace(/,/g, '')) || 0;

  const handleSubmit = async () => {
    if (!numericAmount || numericAmount <= 0) {
      alert('Missing amount', 'Enter how much this payment is for.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await spendApi.commit({
        pocket_id: pocketId,
        amount: numericAmount,
        recipient_key: merchant || undefined,
        category: category || undefined,
      });

      if (result.allowed) {
        await alert('Spend logged', `${result.pocket.name} now has KES ${Math.round(result.pocket.available_balance).toLocaleString()} left.`);
        router.back();
        return;
      }

      if (result.block_reason === 'unclassified_merchant') {
        router.replace({
          pathname: '/(classification)/classify',
          params: { recipientKey: merchant, amount: String(numericAmount) },
        });
        return;
      }

      if (result.block_reason === 'blocked_category') {
        router.replace({
          pathname: '/(blocked)/blocked-spend',
          params: {
            pocketId,
            blockedCategory: result.blocked_category,
            amount: String(numericAmount),
            merchant: merchant || 'Unknown payee',
          },
        });
        return;
      }

      // insufficient_funds or any other reason — no natural screen to route
      // to, so surface it inline instead of dead-ending the flow.
      alert("Can't log this spend", result.message || 'This payment was not allowed.');
    } catch (error: any) {
      alert('Something went wrong', error?.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
            <Pressable onPress={() => router.back()} style={{ padding: spacing.sm }}>
              <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
            <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
              Log a spend
            </Text>
          </View>

          <View style={{ paddingHorizontal: spacing.lg }}>
            <Text style={{ ...typography.body, color: colors.sage }}>
              Record a payment from {pocketName || 'this pocket'} — this app has no bank/PSP connection yet, so spend is simulated the same way income is.
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: spacing.xl,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <Text style={{ ...typography.title, color: colors.sage, marginRight: spacing.sm }}>KSh</Text>
              <TextInput
                value={amount}
                onChangeText={(text) => setAmount(formatAmountInput(text))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.sage}
                style={{
                  flex: 1,
                  ...typography.display,
                  fontSize: 28,
                  color: colors.ink,
                  paddingVertical: spacing.xs,
                  outlineStyle: 'none',
                } as any}
                accessibilityLabel="Spend amount"
              />
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Merchant or payee (optional)</Text>
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                placeholder="e.g. Naivas Supermarket, Juma K."
                placeholderTextColor={colors.sage}
                style={{
                  ...typography.body,
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                } as any}
              />
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
                A new payee without a category gets a one-time "sort this payment" prompt, remembered next time.
              </Text>
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Category (optional)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {CATEGORIES.map((c) => {
                  const selected = category === c.id;
                  return (
                    <Pressable
                      key={c.id || 'unknown'}
                      onPress={() => setCategory(c.id)}
                      style={{
                        paddingVertical: spacing.xs,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.pill,
                        backgroundColor: selected ? colors.emeraldDeep : colors.surface,
                        borderWidth: 1,
                        borderColor: selected ? colors.emeraldDeep : colors.line,
                      }}
                    >
                      <Text style={{ ...typography.caption, color: selected ? colors.surface : colors.ink }}>
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper }}>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: colors.emeraldDeep,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            <ShoppingCart size={16} color={colors.surface} strokeWidth={2} />
            <Text style={{ ...typography.heading, color: colors.surface }}>
              {isSubmitting ? 'Checking…' : 'Log spend'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {modal}
    </SafeAreaView>
  );
}