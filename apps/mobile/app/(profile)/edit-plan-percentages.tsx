import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { LoadingState, ErrorState, Button } from '@/components/ui';
import { profileApi, pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { useAlertModal } from '@/hooks/useAlertModal';
import { ArrowLeft, Plus, Minus, RotateCcw } from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

interface Pocket {
  id: string;
  name: string;
  kind: string;
  category: string | null;
  monthly_allocation: number;
  available_balance: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food & Groceries',
  transport: 'Transport',
  leisure: 'Personal & Leisure',
  family: 'Family & dependents',
  other: 'Other',
  grocery: 'Food & Groceries',
  healthcare: 'Healthcare',
  education: 'Education',
  entertainment: 'Personal & Leisure',
  personal_care: 'Personal Care',
};

const PCT_STEP = 5;

function round2(n: number): number {
  return Math.round(n * 10) / 10;
}

export default function EditPlanPercentagesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert } = useAlertModal();
  const dataSync = useDataSync();
  
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [localPercentages, setLocalPercentages] = useState<Record<string, number> | null>(null);
  const [originalPercentages, setOriginalPercentages] = useState<Record<string, number> | null>(null);
  const [totalSpendable, setTotalSpendable] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load current pocket data
  useEffect(() => {
    loadCurrentPockets();
  }, []);

  const loadCurrentPockets = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get all pockets to calculate current percentages
      const allPockets = await pocketsApi.getAll();
      if (!Array.isArray(allPockets)) {
        setError('Failed to load pockets');
        return;
      }

      // Filter to spendable pockets only
      const spendablePockets = allPockets.filter((p: Pocket) => p.kind === 'spendable');
      setPockets(spendablePockets);

      // Calculate total spendable allocation
      const total = spendablePockets.reduce((sum: number, p: Pocket) => sum + (p.monthly_allocation || 0), 0);
      setTotalSpendable(total);

      // Calculate current percentages by category
      const percentages: Record<string, number> = {};
      const categoryTotals: Record<string, number> = {};
      
      spendablePockets.forEach((pocket: Pocket) => {
        const category = pocket.category || 'other';
        categoryTotals[category] = (categoryTotals[category] || 0) + (pocket.monthly_allocation || 0);
      });

      // Convert to percentages
      Object.keys(categoryTotals).forEach(category => {
        percentages[category] = round2((categoryTotals[category] / total) * 100);
      });

      setLocalPercentages(percentages);
      setOriginalPercentages(percentages);
    } catch (e) {
      console.error('Load pockets error:', e);
      setError('Failed to load pocket data');
    } finally {
      setIsLoading(false);
    }
  };

  const adjust = (category: string, delta: number) => {
    setSaveError(null);
    setLocalPercentages((prev) => {
      if (!prev) return prev;
      const current = prev[category] ?? 0;
      const next = Math.min(100, Math.max(0, current + delta));
      return { ...prev, [category]: round2(next) };
    });
  };

  const handleReset = () => {
    setSaveError(null);
    if (originalPercentages) {
      setLocalPercentages(originalPercentages);
    }
  };

  const handleSave = async () => {
    if (!localPercentages) return;
    
    const total = Object.values(localPercentages).reduce((s, v) => s + (v ?? 0), 0);
    const isBalanced = Math.abs(total - 100) < 0.5;
    
    if (!isBalanced) {
      setSaveError('Percentages must add up to 100%');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      // Call the real API to commit percentage changes
      await profileApi.commitPlanPercentages({
        categoryPercentages: localPercentages,
      });
      
      dataSync.bump();
      await alert('Success', 'Your plan percentages have been updated successfully.');
      safeGoBack(router, '/(profile)/current-plan');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <LoadingState label="Loading plan..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <ErrorState message={error} onRetry={loadCurrentPockets} />
      </SafeAreaView>
    );
  }

  if (!localPercentages || !originalPercentages) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <ErrorState message="Unable to load plan data" onRetry={loadCurrentPockets} />
      </SafeAreaView>
    );
  }

  const categories = Object.keys(localPercentages);
  const total = Object.values(localPercentages).reduce((s, v) => s + (v ?? 0), 0);
  const roundedTotal = round2(total);
  const isBalanced = Math.abs(total - 100) < 0.5;
  const isDirty = categories.some(
    (c) => (localPercentages[c] ?? 0) !== (originalPercentages[c] ?? 0),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable 
            onPress={() => safeGoBack(router, '/(profile)/current-plan')} 
            hitSlop={8} 
            accessibilityLabel="Go back" 
            accessibilityRole="button"
          >
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Edit Plan Percentages
          </Text>
        </View>

        {/* Description */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ ...typography.body, color: colors.sage, lineHeight: 20 }}>
            Adjust how your income is split across different categories. Changes will affect future allocations.
          </Text>
        </View>

        {/* Current total */}
        <View 
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: spacing.lg,
            marginBottom: spacing.lg,
            borderWidth: 1,
            borderColor: isBalanced ? colors.emeraldDeep : colors.clay,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...typography.caption, color: colors.sage }}>Total split</Text>
            <Text 
              style={{ 
                ...typography.heading, 
                color: isBalanced ? colors.emeraldDeep : colors.clay,
                fontVariant: ['tabular-nums'] 
              }}
            >
              {roundedTotal}%
            </Text>
          </View>
          {!isBalanced && (
            <Text style={{ ...typography.caption, color: colors.clay, marginTop: spacing.xs }}>
              Must add up to 100%
            </Text>
          )}
        </View>

        {/* Category rows */}
        <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
          {categories.map((category) => {
            const pct = localPercentages[category] ?? 0;
            const originalPct = originalPercentages[category] ?? 0;
            const changed = Math.abs(pct - originalPct) > 0.1;
            const amount = round2((pct / 100) * totalSpendable);

            return (
              <View
                key={category}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: changed ? colors.emeraldDeep : colors.line,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                  <Text style={{ ...typography.heading, color: colors.ink }}>
                    {CATEGORY_LABELS[category] || category}
                  </Text>
                  {changed && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <RotateCcw size={12} color={colors.sage} />
                      <Text style={{ ...typography.caption, color: colors.sage }}>
                        {round2(originalPct)}%
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Pressable
                    onPress={() => adjust(category, -PCT_STEP)}
                    disabled={pct <= 0 || isSaving}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.xs,
                      backgroundColor: colors.lineSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pct <= 0 || isSaving ? 0.5 : 1,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease ${CATEGORY_LABELS[category]}`}
                  >
                    <Minus size={16} color={colors.ink} strokeWidth={2} />
                  </Pressable>

                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...typography.title, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                      {round2(pct)}%
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                      {formatMoney(amount)} / month
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => adjust(category, PCT_STEP)}
                    disabled={pct >= 100 || isSaving}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.xs,
                      backgroundColor: colors.lineSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pct >= 100 || isSaving ? 0.5 : 1,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase ${CATEGORY_LABELS[category]}`}
                  >
                    <Plus size={16} color={colors.ink} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* Error message */}
        {saveError && (
          <View style={{
            backgroundColor: colors.clayTint,
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
            borderWidth: 1,
            borderColor: colors.clay,
          }}>
            <Text style={{ ...typography.caption, color: colors.clay }}>{saveError}</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={{ gap: spacing.md }}>
          {isDirty && (
            <Button
              variant="secondary"
              fullWidth
              onPress={handleReset}
              disabled={isSaving}
            >
              Reset to current
            </Button>
          )}
          
          <Button
            fullWidth
            onPress={handleSave}
            disabled={!isBalanced || !isDirty || isSaving}
            loading={isSaving}
          >
            Save changes
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}