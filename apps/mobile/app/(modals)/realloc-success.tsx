import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check, Shield } from 'lucide-react-native';
import { colors, radius, spacing, typography, borderWidth } from '@/theme';
import { useHomeStore } from '@/services/home-store';
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

  const amount = Number(params.amount) || 0;

  const handleDone = () => {
    refreshData();
    router.replace('/(tabs)');
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
          <ReviewRow label="From" value={params.fromName} />
          <ReviewRow label="To" value={params.toName} />
          <ReviewRow label="Amount" value={formatCurrency(amount)} />
          {!!params.reasonLabel && <ReviewRow label="Reason" value={params.reasonLabel} />}
          {!!params.newFromBalance && (
            <ReviewRow label={`New ${params.fromName} balance`} value={formatCurrency(Number(params.newFromBalance))} />
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

function ReviewRow({ label, value }: { label?: string; value?: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewKey}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.ink,
    textAlign: 'center',
  },
  subtext: {
    ...typography.body,
    color: colors.sage,
    textAlign: 'center',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    flexDirection: 'row',
    alignItems: 'center',
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
});