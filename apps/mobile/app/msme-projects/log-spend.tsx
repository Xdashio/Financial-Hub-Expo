import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography, borderWidth } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { msmeProjectsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { ScreenContainer, Button } from '@/components/ui';
import { ArrowLeft, ShoppingCart, AlertTriangle } from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

type FundingTier = 'priorities' | 'needs' | 'wants';

interface TierSummary {
  id: string;
  tier: FundingTier;
  sortOrder: number;
  targetAmount: number;
  allocatedAmount: number;
  spentAmount: number;
  remainingCash: number;
  fundingStatus: 'in_progress' | 'complete';
  fundingPercent: number;
}

function tierLabel(t: FundingTier): string {
  if (t === 'priorities') return 'Priorities';
  if (t === 'needs') return 'Needs';
  return 'Wants';
}

function tierColor(tier: FundingTier, colors: any): string {
  if (tier === 'priorities') return colors.emeraldDeep;
  if (tier === 'needs') return colors.gold;
  return colors.clay;
}

export default function MsmeProjectLogSpendScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alert, modal } = useAlertModal();

  const [project, setProject] = useState<any>(null);
  const [tiers, setTiers] = useState<TierSummary[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const formatAmountInput = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, '');
    if (!cleaned) return '';
    return Number(cleaned).toLocaleString();
  };
  const numericAmount = Number(amount.replace(/,/g, '')) || 0;

  useEffect(() => {
    if (!id) return;
    msmeProjectsApi
      .getById(id)
      .then(p => {
        setProject(p);
        const sorted: TierSummary[] = [...p.tiers].sort((a, b) => a.sortOrder - b.sortOrder);
        setTiers(sorted);
        // auto-select tier with remaining >0, prefer Priorities first with remaining
        const withCash = sorted.find(t => t.remainingCash > 0);
        if (withCash) setSelectedTierId(withCash.id);
        else if (sorted.length) setSelectedTierId(sorted[0].id);
      })
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Failed to load tiers'));
  }, [id]);

  const selectedTier = useMemo(() => tiers.find(t => t.id === selectedTierId) ?? null, [tiers, selectedTierId]);
  const availableCash = selectedTier?.remainingCash ?? 0;

  const handleSubmit = async () => {
    if (!id || !selectedTierId) {
      await alert('Pick a tier', 'Choose which tier this spend belongs to (Priorities / Needs / Wants).');
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      await alert('Missing amount', 'Enter how much you spent.');
      return;
    }
    if (selectedTier && numericAmount > availableCash) {
      await alert(
        'Exceeds available cash',
        `${tierLabel(selectedTier.tier)} has ${formatMoney(availableCash)} cash left (Allocated ${formatMoney(selectedTier.allocatedAmount)} − Spent ${formatMoney(selectedTier.spentAmount)}). You tried to log ${formatMoney(numericAmount)}.`,
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await msmeProjectsApi.recordSpend(id, {
        tierId: selectedTierId,
        amount: numericAmount,
        merchant: merchant || undefined,
        category: category || undefined,
        note: note || undefined,
      });
      useDataSync.getState().bump();
      const tierAfter = result.tiers.find(t => t.id === selectedTierId);
      await alert(
        'Spend logged',
        tierAfter
          ? `${tierLabel(tierAfter.tier as FundingTier)} now has ${formatMoney(tierAfter.remainingCash)} cash left. Funding stays ${tierAfter.fundingStatus === 'complete' ? 'Complete' : 'In Progress'} even after spending (§14).`
          : 'Spend recorded.',
      );
      safeGoBack(router, `/msme-projects/detail?id=${id}`);
    } catch (e) {
      await alert('Could not log spend', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <ScreenContainer>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => safeGoBack(router, id ? `/msme-projects/detail?id=${id}` : '/msme-projects')} style={{ padding: spacing.sm }} hitSlop={8}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>Log project spend</Text>
        </View>
        <View style={{ padding: spacing.lg }}>
          <Text style={{ ...typography.body, color: colors.clay }}>{loadError}</Text>
        </View>
        {modal}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
            <Pressable onPress={() => safeGoBack(router, id ? `/msme-projects/detail?id=${id}` : '/msme-projects')} style={{ padding: spacing.sm }} hitSlop={8}>
              <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
            <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>Log project spend</Text>
          </View>

          <View style={{ paddingHorizontal: spacing.lg }}>
            {project && (
              <Text style={{ ...typography.body, color: colors.sage, marginBottom: spacing.md }}>
                Spend is tracked separately from funding — it reduces Cash Left but never flips Funding Status back to In Progress (§14, §15.1).
              </Text>
            )}

            {/* Tier picker */}
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>From tier</Text>
              <View style={{ gap: spacing.sm }}>
                {tiers.map(t => {
                  const selected = selectedTierId === t.id;
                  const c = tierColor(t.tier, colors);
                  const isComplete = t.fundingStatus === 'complete';
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setSelectedTierId(t.id)}
                      style={{
                        paddingVertical: spacing.md,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.md,
                        backgroundColor: selected ? c + '14' : colors.surface,
                        borderWidth: 1,
                        borderColor: selected ? c : colors.line,
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />
                          <Text style={{ ...typography.heading, color: colors.ink }}>{tierLabel(t.tier)}</Text>
                          <View style={{ backgroundColor: isComplete ? colors.emeraldTint : colors.goldTint, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 2 }}>
                            <Text style={{ ...typography.caption, fontSize: 10, color: isComplete ? colors.emeraldDeep : colors.gold }}>{isComplete ? 'Complete' : 'In Progress'}</Text>
                          </View>
                        </View>
                        <Text style={{ ...typography.caption, color: colors.sage, fontVariant: ['tabular-nums'] }}>{formatMoney(t.allocatedAmount)} alloc</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
                        <Text style={{ ...typography.caption, color: colors.sage }}>Cash left {formatMoney(t.remainingCash)}</Text>
                        <Text style={{ ...typography.caption, color: colors.sage }}>Spent {formatMoney(t.spentAmount)}</Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.sm }}>
                        <View style={{ height: '100%', width: `${Math.min(100, t.fundingPercent)}%`, backgroundColor: c, borderRadius: radius.pill }} />
                      </View>
                      {t.remainingCash === 0 && t.allocatedAmount > 0 && (
                        <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs }}>No cash left in this tier — add income to refill forward tiers, not this one once it’s Complete.</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Amount */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: spacing.xl,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: numericAmount > availableCash ? colors.clay : colors.line,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <Text style={{ ...typography.title, color: colors.sage, marginRight: spacing.sm }}>KSh</Text>
              <TextInput
                value={amount}
                onChangeText={text => setAmount(formatAmountInput(text))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.sage}
                style={
                  {
                    flex: 1,
                    ...typography.display,
                    fontSize: 28,
                    color: colors.ink,
                    paddingVertical: spacing.xs,
                    outlineStyle: 'none',
                  } as any
                }
                accessibilityLabel="Spend amount"
              />
            </View>
            {selectedTier && (
              <Text style={{ ...typography.caption, color: numericAmount > availableCash ? colors.clay : colors.sage, marginTop: spacing.xs }}>
                {tierLabel(selectedTier.tier)} cash left: {formatMoney(availableCash)} · Target {formatMoney(selectedTier.targetAmount)} · Allocated {formatMoney(selectedTier.allocatedAmount)}
              </Text>
            )}
            {selectedTier && numericAmount > availableCash && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs, backgroundColor: colors.clayTint, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.clay + '30' }}>
                <AlertTriangle size={14} color={colors.clay} strokeWidth={2} />
                <Text style={{ ...typography.caption, color: colors.clay, flex: 1 }}>Exceeds available cash in {selectedTier ? tierLabel(selectedTier.tier) : 'this tier'}. Spend cannot exceed Allocated − Spent.</Text>
              </View>
            )}

            {/* Merchant / Payee */}
            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Merchant or payee (optional)</Text>
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                placeholder="e.g. Tuskys, Juma Fundi, Naivas"
                placeholderTextColor={colors.sage}
                style={
                  {
                    ...typography.body,
                    color: colors.ink,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                  } as any
                }
              />
            </View>

            {/* Category */}
            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Category (optional)</Text>
              <TextInput
                value={category}
                onChangeText={setCategory}
                placeholder="e.g. materials, labour, transport"
                placeholderTextColor={colors.sage}
                style={
                  {
                    ...typography.body,
                    color: colors.ink,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                  } as any
                }
              />
            </View>

            {/* Note */}
            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Note (optional, ≤300)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Deposit for chairs & tables"
                placeholderTextColor={colors.sage}
                multiline
                numberOfLines={3}
                maxLength={300}
                style={
                  {
                    ...typography.body,
                    color: colors.ink,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    minHeight: 72,
                    textAlignVertical: 'top',
                  } as any
                }
              />
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, textAlign: 'right' }}>{note.length}/300</Text>
            </View>

            {/* Info box */}
            <View style={{ marginTop: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
              <ShoppingCart size={16} color={colors.sage} strokeWidth={2} style={{ marginTop: 2 }} />
              <Text style={{ ...typography.caption, color: colors.sage, flex: 1, lineHeight: 18 }}>
                Funding stays Complete after spending. Remaining Cash = Allocated − Spent (§14). Next income will not refill this tier — it cascades forward (§15.1).
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper }}>
          <Button fullWidth loading={isSubmitting} leftIcon={<ShoppingCart size={16} color={colors.surface} strokeWidth={2} />} onPress={handleSubmit}>
            Log spend
          </Button>
        </View>
      </KeyboardAvoidingView>
      {modal}
    </ScreenContainer>
  );
}
