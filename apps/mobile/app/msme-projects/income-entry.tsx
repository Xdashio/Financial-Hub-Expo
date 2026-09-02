import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography, shadow } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { msmeProjectsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { ScreenContainer } from '@/components/ui';
import { enqueueWrite } from '@/services/offline-queue';
import { ArrowLeft, Calculator, ShieldCheck, CircleDollarSign, AlertTriangle } from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

type Source = string;

const SOURCES = [
  { id: 'Deposit', label: 'Deposit' },
  { id: 'Progress', label: 'Progress' },
  { id: 'Final', label: 'Final' },
  { id: 'Other', label: 'Other' },
];

const TIER_COLOR: Record<string, string> = {
  priorities: 'emeraldDeep',
  needs: 'gold',
  wants: 'clay',
};

function tierLabel(t: string): string {
  if (t === 'priorities') return 'Priorities';
  if (t === 'needs') return 'Needs';
  return 'Wants';
}

export default function MsmeProjectIncomeEntryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alert, modal } = useAlertModal();

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<string>('Deposit');
  const [label, setLabel] = useState('');
  const [projectSummary, setProjectSummary] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<{ allocations: Array<{ tier: string; amount: number }>; excess: number; nextIncomeGoesTo: string | null } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'short' });
  const isoDate = today.toISOString().slice(0, 10);

  const formatAmountInput = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, '');
    if (!cleaned) return '';
    return Number(cleaned).toLocaleString();
  };
  const numericAmount = Number(amount.replace(/,/g, '')) || 0;

  // load project for tier context (targets, allocated)
  useEffect(() => {
    if (!id) return;
    msmeProjectsApi
      .getById(id)
      .then(setProjectSummary)
      .catch(() => setProjectSummary(null));
  }, [id]);

  const loadPreview = useCallback(
    async (amt: number) => {
      if (!id || !amt || amt <= 0) {
        setPreview(null);
        return;
      }
      setIsPreviewLoading(true);
      try {
        const res = await msmeProjectsApi.previewIncome(id, {
          amount: amt,
          source: source || 'Deposit',
          label: label || undefined,
          date: isoDate,
        });
        setPreview(res);
      } catch {
        setPreview(null);
      } finally {
        setIsPreviewLoading(false);
      }
    },
    [id, source, label, isoDate],
  );

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => loadPreview(numericAmount), 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [numericAmount, loadPreview]);

  // reload preview immediately when source changes and amount already present
  useEffect(() => {
    if (numericAmount > 0) loadPreview(numericAmount);
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!id) {
      await alert('Missing project', 'No project ID was provided.');
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      await alert('Missing amount', 'Enter how much income you received.');
      return;
    }
    try {
      setIsSubmitting(true);
      const body = {
        amount: numericAmount,
        source: source || 'Deposit',
        label: label || undefined,
        date: isoDate,
      };
      let result: any;
      try {
        result = await msmeProjectsApi.recordIncome(id, body);
      } catch (netErr: any) {
        const msg = netErr instanceof Error ? netErr.message : String(netErr);
        const isNetwork = /network|fetch|timeout|offline/i.test(msg) || netErr?.status === undefined;
        if (isNetwork) {
          await enqueueWrite(`/msme/projects/${id}/income`, body as any);
          await alert('Queued offline', 'No connection — this instalment will be sent when you’re back online.');
          safeGoBack(router, `/msme-projects/detail?id=${id}`);
          return;
        }
        throw netErr;
      }
      useDataSync.getState().bump();
      // cascade result is reflected in returned project summary — show preview-like confirmation
      const allocationsText = preview?.allocations.length
        ? preview.allocations.map(a => `${tierLabel(a.tier)} ${formatMoney(a.amount)}`).join(' · ')
        : `${formatMoney(numericAmount)} allocated`;
      if ((result as any)?.excessPending != null && Number((result as any).excessPending) > 0) {
        await alert(
          'Income recorded — excess pending',
          `${allocationsText}. Excess ${formatMoney(Number((result as any).excessPending))} needs your direction — open the project to resolve it.`,
        );
      } else {
        await alert(
          'Income recorded',
          result.nextIncomeGoesTo
            ? `${allocationsText}. Next payment goes to ${tierLabel(result.nextIncomeGoesTo as any)}.`
            : `${allocationsText}. All tiers funded${(preview?.excess ?? 0) > 0 ? ` · Excess ${formatMoney(preview!.excess)} pending` : ''}.`,
        );
      }
      safeGoBack(router, `/msme-projects/detail?id=${id}`);
    } catch (e) {
      await alert('Could not add income', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
            <Pressable onPress={() => safeGoBack(router, id ? `/msme-projects/detail?id=${id}` : '/msme-projects')} style={{ padding: spacing.sm }} hitSlop={8}>
              <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
            <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>Project income</Text>
          </View>

          <View style={{ paddingHorizontal: spacing.lg }}>
            {projectSummary ? (
              <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
                <Text style={{ ...typography.caption, color: colors.sage }}>{projectSummary.name} · {projectSummary.kind}</Text>
                <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                  Contract {formatMoney(projectSummary.contractValue)} · {formatMoney(projectSummary.totalAllocated)} allocated
                  {projectSummary.nextIncomeGoesTo ? ` · Next: ${tierLabel(projectSummary.nextIncomeGoesTo)}` : ' · All funded'}
                </Text>
              </View>
            ) : null}

            <Text style={{ ...typography.body, color: colors.sage }}>
              Log a client payment instalment (Deposit / Progress / Final). The Funding Cascade (§15) auto-allocates to the highest unfunded tier.
            </Text>

            {/* Amount */}
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
                onChangeText={text => setAmount(formatAmountInput(text))}
                keyboardType="number-pad"
                placeholder="50,000"
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
                accessibilityLabel="Income amount"
              />
            </View>

            {/* Source chips — Deposit/Progress/Final */}
            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Source (instalment stage)</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {SOURCES.map(s => {
                  const selected = source === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSource(s.id)}
                      style={{
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.pill,
                        backgroundColor: selected ? colors.emeraldDeep : colors.surface,
                        borderWidth: 1,
                        borderColor: selected ? colors.emeraldDeep : colors.line,
                      }}
                    >
                      <Text style={{ ...typography.caption, color: selected ? colors.surface : colors.ink }}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>Matches §16 Down Payments & Instalments: Deposit → Progress → Final.</Text>
            </View>

            {/* Label */}
            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Note (optional)</Text>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="e.g. Deposit via M-Pesa — Wanjiku"
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

            {/* Date */}
            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Date received</Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                }}
              >
                <Text style={{ ...typography.body, color: colors.ink }}>Today, {dateLabel}</Text>
                <Calculator size={16} color={colors.sage} strokeWidth={1.7} />
              </View>
            </View>

            {/* Preview cascade card — emeraldTint like (income)/entry.tsx */}
            <View
              style={{
                marginTop: spacing.lg,
                padding: spacing.lg,
                borderRadius: radius.md,
                backgroundColor: colors.emeraldTint,
                borderWidth: 1,
                borderColor: colors.emeraldDeep + '20',
              }}
            >
              <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginBottom: spacing.sm, letterSpacing: 0.4 }}>
                {isPreviewLoading ? 'Calculating cascade…' : preview ? 'Cascade preview — where this payment will go' : 'Cascade preview'}
              </Text>
              {preview && preview.allocations.length > 0 ? (
                <>
                  {preview.allocations.map(a => {
                    const colorKey = TIER_COLOR[a.tier] ?? 'emeraldDeep';
                    const c: any = (colors as any)[colorKey] ?? colors.emeraldDeep;
                    return (
                      <View key={a.tier} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
                          <Text style={{ ...typography.body, color: colors.ink }}>{tierLabel(a.tier)}</Text>
                          <ShieldCheck size={12} color={c} strokeWidth={2} />
                        </View>
                        <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatMoney(a.amount)}</Text>
                      </View>
                    );
                  })}
                  {preview.excess > 0 && (
                    <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.goldTint, borderRadius: radius.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.gold + '30' }}>
                      <AlertTriangle size={14} color={colors.gold} strokeWidth={2} />
                      <Text style={{ ...typography.caption, color: colors.gold, flex: 1 }}>Excess {formatMoney(preview.excess)} — all tiers funded. You’ll be prompted to direct it (Phase 5 excess flow).</Text>
                    </View>
                  )}
                  {preview.nextIncomeGoesTo && (
                    <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginTop: spacing.sm }}>Next income would go to {tierLabel(preview.nextIncomeGoesTo)}</Text>
                  )}
                  {!preview.nextIncomeGoesTo && preview.excess === 0 && (
                    <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginTop: spacing.sm }}>This income funds the remaining tiers exactly.</Text>
                  )}
                </>
              ) : numericAmount > 0 ? (
                <Text style={{ ...typography.caption, color: colors.sage }}>Enter an amount to see the cascade. The cascade never refills a completed tier — income flows forward to the next unfunded tier (§15.1).</Text>
              ) : (
                <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>Enter an amount to see how it would be split across Priorities → Needs → Wants.</Text>
              )}
              {projectSummary && preview && preview.allocations.length === 0 && preview.excess === 0 && numericAmount > 0 && (
                <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.sm }}>All tiers already funded — this payment would be excess.</Text>
              )}
            </View>

            {projectSummary && !projectSummary.isActiveCascade && (
              <View style={{ marginTop: spacing.md, backgroundColor: colors.clayTint, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.clay + '30', flexDirection: 'row', gap: spacing.sm }}>
                <AlertTriangle size={16} color={colors.clay} strokeWidth={2} style={{ marginTop: 1 }} />
                <Text style={{ ...typography.caption, color: colors.clay, flex: 1, lineHeight: 18 }}>Cascade is not active for this project. Activate it in the project detail screen before recording income.</Text>
              </View>
            )}
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
            <CircleDollarSign size={18} color={colors.surface} strokeWidth={2} />
            <Text style={{ ...typography.heading, color: colors.surface }}>{isSubmitting ? 'Recording…' : 'Record income & run cascade'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {modal}
    </ScreenContainer>
  );
}
