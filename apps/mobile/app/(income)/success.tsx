import React from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check, Shield } from 'lucide-react-native';
import { radius, spacing, typography, borderWidth } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useHomeStore } from '@/services/home-store';
import { useDataSync } from '@/services/data-sync';
import { Button, ScreenContainer, SafeScrollView } from '@/components/ui';
import { formatMoney } from '@/utils/money';

interface ProjectedAllocation {
  pocket_id: string;
  pocket_name: string;
  amount: number;
  percentage: number;
  is_minimum?: boolean;
}

type SuccessParams = {
  amount: string;
  triggered: string; // 'true' | 'false'
  allocations?: string; // JSON-stringified ProjectedAllocation[]
  totalAllocated?: string;
  unallocated?: string;
};

function formatCurrency(amount: number) {
  return formatMoney(amount);
}

export default function IncomeSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<SuccessParams>();
  const refreshData = useHomeStore((s) => s.refreshData);
  const { colors } = useTheme();

  const amount = Number(params.amount) || 0;
  const triggered = params.triggered === 'true';
  const unallocated = Number(params.unallocated) || 0;

  let allocations: ProjectedAllocation[] = [];
  try {
    allocations = params.allocations ? JSON.parse(params.allocations) : [];
  } catch {
    allocations = [];
  }

  const handleDone = () => {
    useDataSync.getState().bump();
    refreshData();
    router.replace('/(tabs)');
  };

  const styles = {
    hero: {
      alignItems: 'center' as const,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    icon: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: colors.emeraldTint,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginBottom: spacing.md,
    },
    title: {
      ...typography.title,
      color: colors.ink,
      textAlign: 'center' as const,
    },
    subtext: {
      ...typography.body,
      color: colors.sage,
      textAlign: 'center' as const,
      marginTop: spacing.sm,
    },
    bold: {
      color: colors.ink,
      fontFamily: typography.heading.fontFamily,
    },
    sectionLabel: {
      ...typography.eyebrow,
      color: colors.sage,
      marginTop: spacing.xxl,
      marginBottom: spacing.sm,
    },
    reviewList: {
      backgroundColor: colors.surface,
      borderWidth: borderWidth,
      borderColor: colors.line,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    reviewRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
    },
    reviewKey: {
      ...typography.body,
      color: colors.ink,
    },
    reviewValue: {
      ...typography.body,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    } as any,
    totalRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      borderTopWidth: borderWidth,
      borderTopColor: colors.line,
      marginTop: spacing.xs,
      paddingTop: spacing.sm,
    },
    totalKey: {
      ...typography.heading,
      color: colors.ink,
    },
    totalValue: {
      ...typography.heading,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    } as any,
    protectStrip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.xs,
      backgroundColor: colors.emeraldTint,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    protectText: {
      ...typography.caption,
      color: colors.emeraldDeep,
      flex: 1,
    },
  };

  return (
    <ScreenContainer>
      <SafeScrollView>
        <View style={styles.hero}>
          <View style={styles.icon}>
            <Check size={28} color={colors.emeraldDeep} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>Income added</Text>
          <Text style={styles.subtext}>
            {triggered ? (
              <>
                <Text style={styles.bold}>{formatCurrency(amount)}</Text> split into your pockets using your
                plan's rules.
              </>
            ) : (
              <>
                <Text style={styles.bold}>{formatCurrency(amount)}</Text> logged without allocating — you can
                allocate it later.
              </>
            )}
          </Text>
        </View>

        {triggered && allocations.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Where it went</Text>
            <View style={styles.reviewList}>
              {allocations.map((a) => (
                <View key={a.pocket_id} style={styles.reviewRow}>
                  <Text style={styles.reviewKey}>
                    {a.pocket_name}
                    {a.is_minimum ? ' (10% min)' : ''}
                  </Text>
                  <Text style={styles.reviewValue}>{formatCurrency(a.amount)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalKey}>Total allocated</Text>
                <Text style={styles.totalValue}>{formatCurrency(amount - unallocated)}</Text>
              </View>
              {unallocated > 0 && (
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewKey}>Unallocated</Text>
                  <Text style={styles.reviewValue}>{formatCurrency(unallocated)}</Text>
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.protectStrip}>
          <Shield size={14} color={colors.emeraldDeep} strokeWidth={2} />
          <Text style={styles.protectText}>
            {triggered
              ? 'Logged to your ledger — reflected in every pocket balance now.'
              : 'Logged to your ledger — allocate it anytime from a pocket.'}
          </Text>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <Button fullWidth size="lg" onPress={handleDone}>
            Back to home
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}