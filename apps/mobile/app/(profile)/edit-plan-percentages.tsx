import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { LoadingState, ErrorState, Button } from '@/components/ui';
import { profileApi, pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { useAlertModal } from '@/hooks/useAlertModal';
import { SPENDABLE_CATEGORY_LABELS } from '@financial-hub/shared';
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

const PCT_STEP = 1;

function round2(n: number): number {
  return Math.round(n * 10) / 10;
}

// Ensure percentages always add up to exactly 100%
function normalizePercentages(percentages: Record<string, number>): Record<string, number> {
  const categories = Object.keys(percentages);
  const total = Object.values(percentages).reduce((s, v) => s + (v ?? 0), 0);
  const roundedTotal = round2(total);
  
  // Always normalize if not exactly 100% - remove tolerance to prevent 100.1% issues
  if (Math.abs(roundedTotal - 100) < 0.01) {
    // Already exactly 100%, return as-is
    return percentages;
  }
  
  // Normalize to exactly 100%
  const normalized: Record<string, number> = {};
  const diff = 100 - roundedTotal;
  
  // Distribute the difference across categories proportionally
  categories.forEach((cat, index) => {
    const weight = percentages[cat] / total; // Weight by current share
    normalized[cat] = round2(percentages[cat] + (diff * weight));
  });
  
  // Final adjustment to ensure exactly 100%
  const finalTotal = Object.values(normalized).reduce((s, v) => s + (v ?? 0), 0);
  const finalDiff = 100 - round2(finalTotal);
  if (categories.length > 0 && Math.abs(finalDiff) > 0) {
    normalized[categories[0]] = round2(normalized[categories[0]] + finalDiff);
  }
  
  return normalized;
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
      const updated = { ...prev, [category]: round2(next) };
      const normalized = normalizePercentages(updated);
      return normalized;
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
    const roundedTotal = round2(total);
    const isBalanced = Math.abs(roundedTotal - 100) < 0.01;

    if (!isBalanced) {
      setSaveError('Percentages must add up to exactly 100%');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      // Call the API to commit percentage changes directly
      const result = await profileApi.commitPlanPercentages({
        categoryPercentages: localPercentages,
      });

      console.log('Save result:', result);

      dataSync.bump();
      await alert('Success', 'Your plan percentages have been updated successfully.');
      safeGoBack(router, '/(profile)/current-plan');
    } catch (error: any) {
      console.error('Failed to save percentages:', error);

      // User-friendly error messages
      let errorMessage = 'Could not save your changes. Please try again.';

      if (error?.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('404') || msg.includes('not found')) {
          errorMessage = 'Your plan could not be found. Please refresh and try again.';
        } else if (msg.includes('400') || msg.includes('invalid')) {
          errorMessage = 'The percentage values are not valid. Please check your inputs.';
        } else if (msg.includes('401') || msg.includes('unauthorized')) {
          errorMessage = 'Please log in again to save your changes.';
        } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('cors')) {
          errorMessage = 'Connection issue. Please check your internet and try again.';
        } else if (msg.includes('cannot post')) {
          errorMessage = 'Unable to save changes. Please try again later.';
        } else {
          // Include the actual error message for debugging
          errorMessage = `Error: ${error.message}`;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setSaveError(errorMessage);
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
  const isBalanced = Math.abs(roundedTotal - 100) < 0.01;
  const isDirty = categories.some(
    (c) => (localPercentages[c] ?? 0) !== (originalPercentages[c] ?? 0),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.lg }}>
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
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.sage, lineHeight: 22 }}>
            Adjust how your income is split across different categories. Changes will affect future allocations.
          </Text>
        </View>

        {/* Total indicator */}
        <View 
          style={{
            backgroundColor: isBalanced ? colors.emeraldTint : colors.clayTint,
            borderRadius: radius.lg,
            padding: spacing.lg,
            marginBottom: spacing.xl,
            borderWidth: 1.5,
            borderColor: isBalanced ? colors.emeraldDeep : colors.clay,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...typography.heading, color: isBalanced ? colors.emeraldDeep : colors.clay }}>
              Total split
            </Text>
            <Text 
              style={{ 
                ...typography.title, 
                color: isBalanced ? colors.emeraldDeep : colors.clay,
                fontVariant: ['tabular-nums'] 
              }}
            >
              {roundedTotal}%
            </Text>
          </View>
          {!isBalanced && (
            <Text style={{ ...typography.caption, color: colors.clay, marginTop: spacing.sm }}>
              Must add up to exactly 100%
            </Text>
          )}
        </View>

        {/* Category cards */}
        <View style={{ gap: spacing.lg, marginBottom: spacing.xl }}>
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
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  borderWidth: 1.5,
                  borderColor: changed ? colors.emeraldDeep : colors.line,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <Text style={{ ...typography.heading, color: colors.ink }}>
                    {SPENDABLE_CATEGORY_LABELS[category as keyof typeof SPENDABLE_CATEGORY_LABELS] || category}
                  </Text>
                  {changed && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.emeraldTint, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
                      <RotateCcw size={12} color={colors.emeraldDeep} />
                      <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                        {round2(originalPct)}%
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                  <Pressable
                    onPress={() => adjust(category, -PCT_STEP)}
                    disabled={pct <= 0 || isSaving}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: radius.md,
                      backgroundColor: colors.lineSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pct <= 0 || isSaving ? 0.4 : 1,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease ${SPENDABLE_CATEGORY_LABELS[category as keyof typeof SPENDABLE_CATEGORY_LABELS] || category}`}
                  >
                    <Minus size={20} color={colors.ink} strokeWidth={2} />
                  </Pressable>

                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...typography.display, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                      {round2(pct)}%
                    </Text>
                    <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.xs }}>
                      {formatMoney(amount)} / month
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => adjust(category, PCT_STEP)}
                    disabled={pct >= 100 || isSaving}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: radius.md,
                      backgroundColor: colors.lineSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pct >= 100 || isSaving ? 0.4 : 1,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase ${SPENDABLE_CATEGORY_LABELS[category as keyof typeof SPENDABLE_CATEGORY_LABELS] || category}`}
                  >
                    <Plus size={20} color={colors.ink} strokeWidth={2} />
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
            borderRadius: radius.lg,
            padding: spacing.lg,
            marginBottom: spacing.xl,
            borderWidth: 1.5,
            borderColor: colors.clay,
          }}>
            <Text style={{ ...typography.body, color: colors.clay }}>{saveError}</Text>
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