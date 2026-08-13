import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { incomeApi, createIdempotencyKey } from '@/services/api';
import { useHomeStore } from '@/services/home-store';
import { useDataSync } from '@/services/data-sync';
import { ArrowLeft, Plus, Calendar } from 'lucide-react-native';
import { showAllocationReceived } from '@/services/notifications';
import { enqueueWrite } from '@/services/offline-queue';
import { MoneyAllocationPrompt } from '@/components/ui';
import { safeGoBack } from '@/utils/navigation';

type Source = 'client_payment' | 'cash' | 'other';

const SOURCES: { id: Source; label: string }[] = [
  { id: 'client_payment', label: 'Client payment' },
  { id: 'cash', label: 'Cash' },
  { id: 'other', label: 'Other' },
];

interface ProjectedAllocation {
  pocket_id: string;
  pocket_name: string;
  amount: number;
  percentage: number;
  is_minimum?: boolean;
}

export default function IncomeEntryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert, modal } = useAlertModal();

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<Source>('client_payment');
  const [label, setLabel] = useState('');
  const [runAllocation, setRunAllocation] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Surplus allocation state
  const [surplusPrompt, setSurplusPrompt] = useState<{
    visible: boolean;
    incomeEventId: string;
    surplusAmount: number;
  }>({
    visible: false,
    incomeEventId: '',
    surplusAmount: 0,
  });

  const [preview, setPreview] = useState<{
    projected_allocations: ProjectedAllocation[];
    total_allocated: number;
    unallocated: number;
  } | null>(null);
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

  const loadPreview = useCallback((amt: number, src: Source) => {
    if (!amt || amt <= 0) {
      setPreview(null);
      return;
    }
    setIsPreviewLoading(true);
    incomeApi
      .allocatePreview({ amount: amt, source: src })
      .then((res) => setPreview(res.preview))
      .catch(() => setPreview(null))
      .finally(() => setIsPreviewLoading(false));
  }, []);

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    if (!runAllocation) {
      setPreview(null);
      return;
    }
    previewTimer.current = setTimeout(() => loadPreview(numericAmount, source), 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [numericAmount, source, runAllocation, loadPreview]);

  const applyOptimisticDelta = useHomeStore((s) => s.applyOptimisticDelta);
  const rollbackOptimisticUpdate = useHomeStore((s) => s.rollbackOptimisticUpdate);

  const handleSubmit = async () => {
    if (!numericAmount || numericAmount <= 0) {
      alert('Missing amount', 'Enter how much income you received.');
      return;
    }

    // If a preview has already loaded for this amount/source, apply it to
    // Home right away — the split almost always matches what the server
    // will actually allocate (same proportional-split rules run on both
    // sides), so the user sees their pockets fill up the moment they hit
    // submit instead of after a round trip plus a full refetch. Falls
    // back to no optimistic update if run_allocation is off or no preview
    // has resolved yet — better to show nothing than a guess.
    let snapshot: ReturnType<typeof applyOptimisticDelta> | null = null;
    if (runAllocation && preview && preview.projected_allocations.length > 0) {
      const deltas: Record<string, number> = {};
      for (const a of preview.projected_allocations) {
        deltas[a.pocket_id] = (deltas[a.pocket_id] || 0) + a.amount;
      }
      snapshot = applyOptimisticDelta(deltas);
    }

    const idempotencyKey = createIdempotencyKey('income');
    try {
      setIsSubmitting(true);
      const result = await incomeApi.createManual({
        amount: numericAmount,
        source,
        label: label || undefined,
        date: isoDate,
        run_allocation: runAllocation,
        idempotency_key: idempotencyKey,
      });

      // Reconcile with the server's actual allocation (source of truth —
      // the preview can drift from it, e.g. if pockets changed between
      // preview and submit) rather than trusting the optimistic guess.
      useDataSync.getState().bump();

      if (result.allocation.triggered && result.allocation.total_allocated > 0) {
        void showAllocationReceived(
          result.allocation.total_allocated,
          result.allocation.allocations.length,
        );
      }

      // Check for surplus and show allocation prompt
      if (result.surplus?.has_surplus && result.surplus.surplus_amount > 0) {
        setSurplusPrompt({
          visible: true,
          incomeEventId: result.income_event.id,
          surplusAmount: result.surplus.surplus_amount,
        });
        return;
      }

      router.replace({
        pathname: '/(income)/success',
        params: {
          amount: String(numericAmount),
          triggered: String(result.allocation.triggered),
          allocations: JSON.stringify(result.allocation.allocations),
          totalAllocated: String(result.allocation.total_allocated),
          unallocated: String(result.allocation.unallocated),
        },
      });
    } catch (error: any) {
      if (snapshot) rollbackOptimisticUpdate(snapshot);
      const message = error?.message || 'Please try again.';
      const looksNetwork =
        /network|fetch|timeout|failed to fetch|network request failed/i.test(String(message));
      if (looksNetwork) {
        await enqueueWrite('/income/manual', {
          amount: numericAmount,
          source,
          label: label || undefined,
          date: isoDate,
          run_allocation: runAllocation,
          idempotency_key: idempotencyKey,
        });
        alert(
          'Saved offline',
          'We could not reach the server. This income entry will retry automatically when you are back online.',
        );
      } else {
        alert('Couldn\u2019t add income', message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => `KES ${Math.round(value).toLocaleString()}`;

  const handleSurplusAllocation = async (optionId: string) => {
    if (!surplusPrompt.incomeEventId) return;

    try {
      setIsSubmitting(true);

      if (optionId === 'pocket') {
        // Navigate to pocket picker screen
        setSurplusPrompt({ visible: false, incomeEventId: '', surplusAmount: 0 });
        setIsSubmitting(false);
        router.push({
          pathname: '/(modals)/surplus-pocket-picker',
          params: {
            incomeEventId: surplusPrompt.incomeEventId,
            surplusAmount: String(surplusPrompt.surplusAmount),
          },
        });
        return;
      }

      if (optionId === 'new_pocket') {
        // Navigate to pocket creation screen
        setSurplusPrompt({ visible: false, incomeEventId: '', surplusAmount: 0 });
        setIsSubmitting(false);
        router.push({
          pathname: '/(modals)/surplus-create-pocket',
          params: {
            incomeEventId: surplusPrompt.incomeEventId,
            surplusAmount: String(surplusPrompt.surplusAmount),
          },
        });
        return;
      }

      // Handle main_pocket allocation
      await incomeApi.allocateSurplus(surplusPrompt.incomeEventId, {
        target: 'main_pocket',
      });

      // Refresh data and navigate to success
      useDataSync.getState().bump();
      setSurplusPrompt({ visible: false, incomeEventId: '', surplusAmount: 0 });

      router.replace({
        pathname: '/(income)/success',
        params: {
          amount: String(numericAmount),
          triggered: 'true',
          allocations: JSON.stringify([]),
          totalAllocated: String(surplusPrompt.surplusAmount),
          unallocated: '0',
        },
      });
    } catch (error: any) {
      const message = error?.message || 'Failed to allocate surplus. Please try again.';
      alert('Allocation failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSurplusCancel = () => {
    setSurplusPrompt({ visible: false, incomeEventId: '', surplusAmount: 0 });
    // Navigate to success screen even if surplus is not allocated
    router.replace({
      pathname: '/(income)/success',
      params: {
        amount: String(numericAmount),
        triggered: 'true',
        allocations: JSON.stringify([]),
        totalAllocated: '0',
        unallocated: String(surplusPrompt.surplusAmount),
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
            <Pressable onPress={() => safeGoBack(router, '/(tabs)')} style={{ padding: spacing.sm }} hitSlop={8}>
              <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
            <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
              Add income
            </Text>
          </View>

          <View style={{ paddingHorizontal: spacing.lg }}>
            <Text style={{ ...typography.body, color: colors.sage }}>
              Log income that wasn't captured automatically — a client payment, cash, or a side income source.
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
                placeholder="50,000"
                placeholderTextColor={colors.sage}
                style={{
                  flex: 1,
                  ...typography.display,
                  fontSize: 28,
                  color: colors.ink,
                  paddingVertical: spacing.xs,
                  outlineStyle: 'none',
                } as any}
                accessibilityLabel="Income amount"
              />
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Source</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {SOURCES.map((s) => {
                  const selected = source === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSource(s.id)}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.sm,
                        alignItems: 'center',
                        backgroundColor: selected ? colors.emeraldDeep : colors.surface,
                        borderWidth: 1,
                        borderColor: selected ? colors.emeraldDeep : colors.line,
                      }}
                    >
                      <Text style={{ ...typography.caption, color: selected ? colors.surface : colors.ink }}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Label (optional)</Text>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="e.g. Website project — Kito Ltd"
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
            </View>

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
                <Calendar size={16} color={colors.sage} strokeWidth={1.7} />
              </View>
            </View>

            <Pressable
              onPress={() => setRunAllocation((v) => !v)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: spacing.xl,
                paddingVertical: spacing.md,
              }}
            >
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ ...typography.heading, color: colors.ink }}>Run allocation now</Text>
                <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                  Split this into your pockets immediately using your plan's rules
                </Text>
              </View>
              <View
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  padding: 2,
                  backgroundColor: runAllocation ? colors.emeraldDeep : colors.lineSoft,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                    transform: [{ translateX: runAllocation ? 20 : 0 }],
                  }}
                />
              </View>
            </Pressable>

            {runAllocation && (
              <View
                style={{
                  marginTop: spacing.md,
                  padding: spacing.lg,
                  borderRadius: radius.md,
                  backgroundColor: colors.emeraldTint,
                }}
              >
                <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginBottom: spacing.sm }}>
                  {isPreviewLoading ? 'Calculating…' : 'If allocated now'}
                </Text>
                {preview && preview.projected_allocations.length > 0 ? (
                  <>
                    {preview.projected_allocations.map((a) => (
                      <View
                        key={a.pocket_id}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}
                      >
                        <Text style={{ ...typography.body, color: colors.ink }}>
                          {a.pocket_name}{a.is_minimum ? ' (10% min)' : ''}
                        </Text>
                        <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                          {formatCurrency(a.amount)}
                        </Text>
                      </View>
                    ))}
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.emeraldDeep + '33', marginTop: spacing.sm, paddingTop: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ ...typography.heading, color: colors.emeraldDeep }}>Total allocated</Text>
                      <Text style={{ ...typography.heading, color: colors.emeraldDeep, fontVariant: ['tabular-nums'] }}>
                        {formatCurrency(preview.total_allocated)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                    Enter an amount to see how it would be split.
                  </Text>
                )}
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
            <Text style={{ ...typography.heading, color: colors.surface }}>
              {isSubmitting ? 'Adding…' : 'Add income'}
            </Text>
            {!isSubmitting && <Plus size={16} color={colors.surface} strokeWidth={2} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {modal}
      
      <MoneyAllocationPrompt
        visible={surplusPrompt.visible}
        title="You have extra income!"
        message="This amount is more than your expected income. How would you like to allocate the surplus?"
        amount={surplusPrompt.surplusAmount}
        onSelectOption={handleSurplusAllocation}
        onCancel={handleSurplusCancel}
        loading={isSubmitting}
      />
    </SafeAreaView>
  );
}