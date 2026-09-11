import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { spendApi, createIdempotencyKey } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { ScreenContainer, Button } from '@/components/ui';
import { ArrowLeft, ShoppingCart } from 'lucide-react-native';
import { enqueueWrite } from '@/services/offline-queue';
import { safeGoBack } from '@/utils/navigation';
import { useHomeStore } from '@/services/home-store';
import { formatMoney } from '@/utils/money';

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

// The commit response's pocket.available_balance is the whole-cycle ledger
// balance, not "left today" — same conflation the home screen had. For a
// daily-cap pocket, lead with today_remaining (falling back to
// available_balance only when the pocket has no cap, e.g. fixed/savings).
function pocketLeftMessage(pocket: { name: string; available_balance: number; daily_cap?: number; today_remaining?: number }): string {
  if (pocket.daily_cap && pocket.today_remaining != null) {
    return `${pocket.name} now has ${formatMoney(pocket.today_remaining)} left today.`;
  }
  return `${pocket.name} now has ${formatMoney(pocket.available_balance)} left.`;
}

export default function LogSpendScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert, confirm, modal } = useAlertModal();
  const params = useLocalSearchParams<{ pocketId: string; pocketName: string }>();
  const pockets = useHomeStore((s) => s.pockets);

  const spendablePockets = useMemo(
    () => pockets.filter((p) => 
      (p.kind === 'spendable' || p.kind === 'fixed' || p.kind === 'savings') && 
      !p.hasSubPockets // Filter out parent pockets with sub-pockets
    ),
    [pockets],
  );

  const [selectedPocketId, setSelectedPocketId] = useState(params.pocketId || '');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pocketId = selectedPocketId || params.pocketId;
  const selectedPocket = spendablePockets.find((p) => p.id === pocketId);
  const pocketName = params.pocketName || selectedPocket?.name || '';
  const needsPocketPick = !params.pocketId;

  const formatAmountInput = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, '');
    if (!cleaned) return '';
    return Number(cleaned).toLocaleString();
  };

  const numericAmount = Number(amount.replace(/,/g, '')) || 0;

  const handleSubmit = async () => {
    if (!pocketId) {
      alert('Pick a pocket', 'Choose which pocket this payment comes from.');
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      alert('Missing amount', 'Enter how much this payment is for.');
      return;
    }

    const idempotencyKey = createIdempotencyKey('spend');
    try {
      setIsSubmitting(true);
      
      // First check if the spend is allowed
      const checkResult = await spendApi.check({
        pocket_id: pocketId,
        amount: numericAmount,
        recipient_key: merchant || undefined,
        category: category || undefined,
      });

      if (checkResult.allowed) {
        // Spend is allowed, proceed to commit
        const payload = {
          pocket_id: pocketId,
          amount: numericAmount,
          recipient_key: merchant || undefined,
          category: category || undefined,
          idempotency_key: idempotencyKey,
        };
        const result = await spendApi.commit(payload);

        if (result.allowed) {
          useDataSync.getState().bump();
          await alert('Spend logged', pocketLeftMessage(result.pocket));
          safeGoBack(router, '/(tabs)');
          return;
        }
      }

      // Handle insufficient_funds with borrow_from_parent option
      if (checkResult.block_reason === 'insufficient_funds' && checkResult.borrow_from_parent_available) {
        // Show borrow confirmation dialog
        const confirmed = await confirm(
          'Borrow from parent?',
          `${checkResult.message || `This pocket is short ${formatMoney(checkResult.shortfall || 0)}`}`,
          { confirmLabel: 'Borrow', cancelLabel: 'Cancel' }
        );
        
        if (confirmed) {
          // User confirmed borrow, commit with borrow_from_parent: true
          const payload = {
            pocket_id: pocketId,
            amount: numericAmount,
            recipient_key: merchant || undefined,
            category: category || undefined,
            idempotency_key: idempotencyKey,
            borrow_from_parent: true,
          };
          const result = await spendApi.commit(payload);

          if (result.allowed) {
            useDataSync.getState().bump();
            await alert('Spend logged', pocketLeftMessage(result.pocket));
            safeGoBack(router, '/(tabs)');
            return;
          }
        } else {
          // User cancelled borrow
          return;
        }
      }

      // Plain insufficient_funds (no borrow-from-parent option): the API
      // still marks this overridable and computes reallocation_sources, so
      // offer "spend anyway" here instead of dead-ending like a hard block.
      // Discloses the discipline-score cost up front (mirrors real overdraft
      // disclosure) rather than letting the user find out only after the
      // fact — see spend.service.ts's recordEssentialOverride for where the
      // actual deduction is applied.
      if (checkResult.block_reason === 'insufficient_funds' && checkResult.overridable) {
        const shortfallText = checkResult.shortfall
          ? ` You're short ${formatMoney(checkResult.shortfall)}.`
          : '';
        const costText = checkResult.override_points_cost
          ? ` This will cost you ${checkResult.override_points_cost} discipline points.`
          : '';
        const confirmed = await confirm(
          "Can't log this spend",
          `${checkResult.message || 'Insufficient funds in this pocket.'}${shortfallText}${costText} Log it anyway?`,
          { confirmLabel: 'Spend anyway', cancelLabel: 'Cancel' }
        );

        if (confirmed) {
          const payload = {
            pocket_id: pocketId,
            amount: numericAmount,
            recipient_key: merchant || undefined,
            category: category || undefined,
            idempotency_key: idempotencyKey,
            override: true,
          };
          const result = await spendApi.commit(payload);

          if (result.allowed) {
            useDataSync.getState().bump();
            await alert('Spend logged', pocketLeftMessage(result.pocket));
            safeGoBack(router, '/(tabs)');
          }
        }
        return;
      }

      // Emergency-overspend confirmation (daily plans only): the pocket has
      // the money, but spending it today blows past the pacing cap meant
      // to stretch it across the rest of the cycle. Show exactly what the
      // cap becomes for the remaining days if the user goes ahead, mirrors
      // the insufficient_funds "spend anyway" pattern above but persists a
      // recalculated daily_cap on confirm instead of just logging an
      // override.
      if (checkResult.block_reason === 'daily_cap_exceeded' && checkResult.overridable) {
        const confirmed = await confirm(
          'Above your daily cap',
          checkResult.message || 'This spend is above what your daily budget can absorb today.',
          { confirmLabel: 'Spend anyway', cancelLabel: 'Adjust amount' }
        );

        if (confirmed) {
          const payload = {
            pocket_id: pocketId,
            amount: numericAmount,
            recipient_key: merchant || undefined,
            category: category || undefined,
            idempotency_key: idempotencyKey,
            override_daily_cap: true,
          };
          const result = await spendApi.commit(payload);

          if (result.allowed) {
            useDataSync.getState().bump();
            const newCap = result.adjusted_daily_cap;
            await alert(
              'Spend logged',
              pocketLeftMessage(result.pocket) +
                (typeof newCap === 'number'
                  ? ` Your daily cap for the rest of the cycle is now ${formatMoney(newCap)}.`
                  : ''),
            );
            safeGoBack(router, '/(tabs)');
          }
        }
        return;
      }

      if (checkResult.block_reason === 'unclassified_merchant') {
        router.push({
          pathname: '/(classification)/classify',
          params: {
            recipientKey: merchant,
            amount: String(numericAmount),
            preferredPocketId: pocketId,
          },
        });
        return;
      }

      if (checkResult.block_reason === 'blocked_category') {
        router.push({
          pathname: '/(blocked)/blocked-spend',
          params: {
            pocketId,
            blockedCategory: checkResult.blocked_category,
            amount: String(numericAmount),
            merchant: merchant || 'Unknown payee',
            reviewAvailable: String(checkResult.review_available ?? true),
          },
        });
        return;
      }

      // insufficient_funds or any other reason — no natural screen to route
      // to, so surface it inline instead of dead-ending the flow.
      alert("Can't log this spend", checkResult.message || 'This payment was not allowed.');
    } catch (error: any) {
      const message = error?.message || 'Please try again.';
      const looksNetwork =
        /network|fetch|timeout|failed to fetch|network request failed/i.test(String(message));
      if (looksNetwork && pocketId && numericAmount > 0) {
        await enqueueWrite('/spend/commit', {
          pocket_id: pocketId,
          amount: numericAmount,
          recipient_key: merchant || undefined,
          category: category || undefined,
          idempotency_key: idempotencyKey,
        });
        alert(
          'Saved offline',
          'We could not reach the server. This spend will retry automatically when you are back online.',
        );
      } else {
        alert('Something went wrong', message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
            <Pressable onPress={() => safeGoBack(router, '/(tabs)')} style={{ padding: spacing.sm }}>
              <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
            <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
              Log spend
            </Text>
          </View>

          <View style={{ paddingHorizontal: spacing.lg }}>
            <Text style={{ ...typography.body, color: colors.sage }}>
              Record a payment from {pocketName || 'a pocket'}. This updates your pocket balance in the app — it does not move money at your bank.
            </Text>

            {needsPocketPick && (
              <View style={{ marginTop: spacing.xl }}>
                <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>From pocket</Text>
                <View style={{ gap: spacing.sm }}>
                  {spendablePockets.map((pocket) => {
                    const selected = pocketId === pocket.id;
                    // Same fix as the home screen: for a daily-cap pocket,
                    // availableBalance is the whole-cycle ledger balance, not
                    // what's safe to spend right now — show todayRemaining
                    // here so this list doesn't imply more headroom than the
                    // daily_cap_exceeded check below will actually allow.
                    const displayAmount = pocket.dailyCap != null ? (pocket.todayRemaining ?? pocket.availableBalance) : pocket.availableBalance;
                    return (
                      <Pressable
                        key={pocket.id}
                        onPress={() => setSelectedPocketId(pocket.id)}
                        style={{
                          paddingVertical: spacing.md,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.md,
                          backgroundColor: selected ? colors.emeraldTint : colors.surface,
                          borderWidth: 1,
                          borderColor: selected ? colors.emeraldDeep : colors.line,
                          minHeight: 44,
                          justifyContent: 'center',
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${pocket.name}, ${formatMoney(displayAmount)} available${pocket.dailyCap != null ? ' today' : ''}`}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ ...typography.body, color: colors.ink }}>{pocket.name}</Text>
                          <Text style={{ ...typography.caption, color: colors.sage, fontVariant: ['tabular-nums'] }}>
                            {formatMoney(displayAmount)}{pocket.dailyCap != null ? ' today' : ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

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
          <Button
            fullWidth
            loading={isSubmitting}
            leftIcon={<ShoppingCart size={16} color={colors.surface} strokeWidth={2} />}
            onPress={handleSubmit}
          >
            Log spend
          </Button>
        </View>
      </KeyboardAvoidingView>
      {modal}
    </ScreenContainer>
  );
}