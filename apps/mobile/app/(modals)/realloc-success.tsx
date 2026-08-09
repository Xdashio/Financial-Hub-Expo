import React from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check, Shield } from 'lucide-react-native';
import { radius, spacing, typography, borderWidth } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useHomeStore } from '@/services/home-store';
import { useDataSync } from '@/services/data-sync';
import { Button, ScreenContainer, SafeScrollView } from '@/components/ui';

type SuccessParams = {
  fromName: string;
  toName: string;
  amount: string;
  reasonLabel?: string;
  newFromBalance?: string;
};

function formatCurrency(amount: number) {
  return `KES ${Math.round(amount).toLocaleString()}`;
}

export default function ReallocSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<SuccessParams>();
  const refreshData = useHomeStore((s) => s.refreshData);
  const { colors } = useTheme();

  const amount = Number(params.amount) || 0;

  const handleDone = () => {
    // Tell every mounted balance-showing screen to refetch regardless of
    // whether it's about to regain focus (see data-sync.ts) — refreshData()
    // alone only covers Home; this also covers Pocket Detail/Insights if
    // they're still mounted underneath.
    useDataSync.getState().bump();
    refreshData();
    // dismissAll() closes the whole (modals) reallocation stack and
    // returns to whatever screen actually presented it — Home, or the
    // Pocket Detail screen the user started from — instead of
    // router.replace('/(tabs)'), which unconditionally discarded that
    // screen (and its place in the stack) and dropped the user on Home
    // even if they'd opened this from a specific pocket. That made a
    // successful reallocation look like it had no effect on the screen
    // the user was actually looking at.
    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/(tabs)');
    }
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
    reviewList: {
      marginTop: spacing.xxl,
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
      ...typography.caption,
      color: colors.sage,
    },
    reviewValue: {
      ...typography.body,
      color: colors.ink,
    },
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
          <Text style={styles.title}>Move completed</Text>
          <Text style={styles.subtext}>
            {formatCurrency(amount)} moved from <Text style={styles.bold}>{params.fromName}</Text> to{' '}
            <Text style={styles.bold}>{params.toName}</Text>.
          </Text>
        </View>

        <View style={styles.reviewList}>
          <ReviewRow label="From" value={params.fromName} styles={styles} />
          <ReviewRow label="To" value={params.toName} styles={styles} />
          <ReviewRow label="Amount" value={formatCurrency(amount)} styles={styles} />
          {!!params.reasonLabel && <ReviewRow label="Reason" value={params.reasonLabel} styles={styles} />}
          {!!params.newFromBalance && (
            <ReviewRow label={`New ${params.fromName} balance`} value={formatCurrency(Number(params.newFromBalance))} styles={styles} />
          )}
        </View>

        <View style={styles.protectStrip}>
          <Shield size={14} color={colors.emeraldDeep} strokeWidth={2} />
          <Text style={styles.protectText}>Remembered — this move is now part of your behaviour history.</Text>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <Button fullWidth size="lg" onPress={handleDone}>
            Back to pockets
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}

function ReviewRow({ label, value, styles }: { label?: string; value?: string; styles: any }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewKey}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}