import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography, borderWidth } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { ScreenContainer, Button, PocketLoader } from '@/components/ui';
import { safeGoBack } from '@/utils/navigation';;
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react-native';
import { formatMoney } from '@/utils/money';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface AllocationSummary {
  total_allocated: number;
  plan_income: number | null;
  unallocated: number;
  over_allocated: boolean;
}

export default function PocketCreateModal() {
  const router = useRouter();
  const { colors } = useTheme();
  const dataSync = useDataSync();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'spendable' | 'fixed' | 'savings'>('spendable');
  const [category, setCategory] = useState('');
  const [monthlyAllocation, setMonthlyAllocation] = useState('');
  const [dailyCap, setDailyCap] = useState('');
  const [loading, setLoading] = useState(false);

  // Plan allocation context — fetched once on mount so we can show
  // "X% of income" feedback and warn before the API hard-blocks it.
  const [allocSummary, setAllocSummary] = useState<AllocationSummary | null>(null);
  const [loadingAlloc, setLoadingAlloc] = useState(true);

  useEffect(() => {
    pocketsApi.getAllocationSummary()
      .then((data: any) => setAllocSummary(data))
      .catch(() => { /* non-fatal, UI degrades gracefully */ })
      .finally(() => setLoadingAlloc(false));
  }, []);

  const parsedAllocation = monthlyAllocation ? parseFloat(monthlyAllocation) : 0;

  // Derived allocation feedback
  const income = allocSummary?.plan_income ?? null;
  const currentTotal = allocSummary?.total_allocated ?? 0;
  const afterTotal = round2(currentTotal + parsedAllocation);
  const pctOfIncome = income && parsedAllocation > 0
    ? round2((parsedAllocation / income) * 100)
    : null;
  const wouldOverAllocate = income != null && afterTotal > income + 0.01;
  const remainingBudget = income != null ? round2(income - currentTotal) : null;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await pocketsApi.create({
        name: name.trim(),
        kind,
        category: category.trim() || undefined,
        monthlyAllocation: parsedAllocation,
        dailyCap: kind === 'spendable' && dailyCap ? parseFloat(dailyCap) : undefined,
      });
      dataSync.bump();
      safeGoBack(router, '/(modals)/pockets-manage');
    } catch (error: any) {
      // API error shown inline if allocation check fails
      console.error('Create pocket error:', error);
    } finally {
      setLoading(false);
    }
  };

  const kindOptions = [
    { value: 'spendable', label: 'Spendable', description: 'For daily spending' },
    { value: 'fixed', label: 'Fixed', description: 'For recurring bills' },
    { value: 'savings', label: 'Savings', description: 'For saving goals' },
  ] as const;

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md }}>
          <Pressable onPress={() => safeGoBack(router, '/(modals)/pockets-manage')} hitSlop={8} accessibilityLabel="Go back" accessibilityRole="button">
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.heading, color: colors.ink }}>Add Pocket</Text>
          <Pressable onPress={handleCreate} disabled={!name.trim() || loading} hitSlop={8}>
            <Text style={{ ...typography.body, color: name.trim() && !loading ? colors.emeraldDeep : colors.lineSoft }}>
              {loading ? 'Creating...' : 'Create'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          {/* ── Name ── */}
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Pocket name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Entertainment, Emergency Fund"
              style={{
                backgroundColor: colors.surface,
                borderWidth,
                borderColor: colors.line,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                ...typography.body,
                color: colors.ink,
              }}
              placeholderTextColor={colors.sage}
            />
          </View>

          {/* ── Kind ── */}
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Pocket type</Text>
            {kindOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setKind(option.value)}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth,
                  borderColor: kind === option.value ? colors.emeraldDeep : colors.line,
                  borderRadius: radius.sm,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <Text style={{ ...typography.body, color: colors.ink }}>{option.label}</Text>
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>{option.description}</Text>
                </View>
                {kind === option.value && (
                  <View style={{ width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={12} color={colors.surface} strokeWidth={2.5} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {/* ── Category ── */}
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Category (optional)</Text>
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="e.g., food, transport, leisure"
              style={{
                backgroundColor: colors.surface,
                borderWidth,
                borderColor: colors.line,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                ...typography.body,
                color: colors.ink,
              }}
              placeholderTextColor={colors.sage}
            />
          </View>

          {/* ── Monthly allocation with income context ── */}
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Monthly allocation (KSh)</Text>
            <TextInput
              value={monthlyAllocation}
              onChangeText={setMonthlyAllocation}
              placeholder="0"
              keyboardType="numeric"
              style={{
                backgroundColor: colors.surface,
                borderWidth,
                borderColor: wouldOverAllocate ? colors.clay : colors.line,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                ...typography.body,
                color: colors.ink,
              }}
              placeholderTextColor={colors.sage}
            />

            {/* Allocation feedback — shows once we have plan context */}
            {loadingAlloc ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                <PocketLoader size={20} color={colors.sage} />
                <Text style={{ ...typography.caption, color: colors.sage }}>Loading plan…</Text>
              </View>
            ) : income != null ? (
              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                {/* Budget bar */}
                <View style={{ height: 4, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden' }}>
                  {/* Already committed */}
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.min(100, (currentTotal / income) * 100)}%`,
                      backgroundColor: colors.sage + '60',
                      borderRadius: radius.pill,
                    }}
                  />
                  {/* This new pocket */}
                  {parsedAllocation > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        left: `${Math.min(100, (currentTotal / income) * 100)}%`,
                        top: 0,
                        bottom: 0,
                        width: `${Math.min(100 - (currentTotal / income) * 100, (parsedAllocation / income) * 100)}%`,
                        backgroundColor: wouldOverAllocate ? colors.clay : colors.emeraldDeep,
                        borderRadius: radius.pill,
                      }}
                    />
                  )}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ ...typography.caption, color: colors.sage }}>
                    {formatMoney(currentTotal)} of {formatMoney(income)} committed
                  </Text>
                  {pctOfIncome !== null && (
                    <Text style={{ ...typography.caption, color: wouldOverAllocate ? colors.clay : colors.emeraldDeep }}>
                      {pctOfIncome}% of income
                    </Text>
                  )}
                </View>

                {/* Over-budget warning */}
                {wouldOverAllocate && (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: spacing.xs,
                    backgroundColor: colors.clayTint,
                    borderRadius: radius.xs,
                    padding: spacing.sm,
                    marginTop: spacing.xs,
                  }}>
                    <AlertTriangle size={13} color={colors.clay} strokeWidth={2} style={{ marginTop: 1 }} />
                    <Text style={{ ...typography.caption, color: colors.clay, flex: 1, lineHeight: 17 }}>
                      This would put {formatMoney(afterTotal)} against a {formatMoney(income)} income — {formatMoney(round2(afterTotal - income))} over. Reduce the allocation or free up space in another pocket first.
                    </Text>
                  </View>
                )}

                {/* Remaining headroom hint when field is empty */}
                {!parsedAllocation && remainingBudget !== null && remainingBudget > 0 && (
                  <Text style={{ ...typography.caption, color: colors.sage }}>
                    {formatMoney(remainingBudget)} unallocated — available for this pocket
                  </Text>
                )}
              </View>
            ) : null}
          </View>

          {/* ── Daily cap — spendable only ── */}
          {kind === 'spendable' && (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Daily cap (KSh, optional)</Text>
              <TextInput
                value={dailyCap}
                onChangeText={setDailyCap}
                placeholder="0"
                keyboardType="numeric"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth,
                  borderColor: colors.line,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                  ...typography.body,
                  color: colors.ink,
                }}
                placeholderTextColor={colors.sage}
              />
            </View>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}