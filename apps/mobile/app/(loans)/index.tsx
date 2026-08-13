import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography, shadow, borderWidth } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { loansApi } from '@/services/api';
import { ScreenContainer, LoadingState, ErrorState, Button } from '@/components/ui';
import {
  ArrowLeft,
  Plus,
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle,
} from 'lucide-react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Loan {
  id: string;
  name: string;
  kind: 'loan';
  monthly_allocation: number;
  repayment_schedule: {
    totalAmount: number;
    repaymentAmount: number;
    cadence: 'weekly' | 'biweekly' | 'monthly';
    startDate: string;
    endDate: string;
    nextDueDate: string;
    totalPayments: number;
    paymentsMade: number;
  };
  loan_provider: string | null;
  loan_purpose: string | null;
  due_day: number;
  subPockets: Array<{
    id: string;
    name: string;
    available_balance: number;
  }>;
  progress: {
    paymentsMade: number;
    totalPayments: number;
    percentagePaid: number;
    amountPaid: number;
    amountRemaining: number;
    nextDueDate: string;
    isOverdue: boolean;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return `KES ${Math.round(amount).toLocaleString()}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCadenceLabel(cadence: string) {
  switch (cadence) {
    case 'weekly': return 'Weekly';
    case 'biweekly': return 'Every 2 weeks';
    case 'monthly': return 'Monthly';
    default: return cadence;
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LoanCard({ loan, colors, onPress }: { loan: Loan; colors: any; onPress: () => void }) {
  const { progress, repayment_schedule, loan_provider, loan_purpose } = loan;
  const isOverdue = progress.isOverdue;
  
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: radius.sm,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: borderWidth,
        borderColor: colors.lineSoft,
        opacity: pressed ? 0.8 : 1,
        ...shadow.elevated,
      })}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.heading, color: colors.ink }} numberOfLines={1}>
            {loan.name}
          </Text>
          {loan_provider && (
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
              {loan_provider}
            </Text>
          )}
        </View>
        {isOverdue ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.clayTint, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
            <AlertCircle size={12} color={colors.clay} strokeWidth={2} />
            <Text style={{ ...typography.caption, fontSize: 11, color: colors.clay }}>Overdue</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.emeraldTint, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
            <CheckCircle size={12} color={colors.emeraldDeep} strokeWidth={2} />
            <Text style={{ ...typography.caption, fontSize: 11, color: colors.emeraldDeep }}>Active</Text>
          </View>
        )}
      </View>

      {/* Progress */}
      <View style={{ marginTop: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          <Text style={{ ...typography.caption, color: colors.sage }}>
            Repayment Progress
          </Text>
          <Text style={{ ...typography.caption, color: colors.ink, fontVariant: ['tabular-nums'] }}>
            {progress.paymentsMade} / {progress.totalPayments} payments
          </Text>
        </View>
        <View
          style={{
            height: 6,
            backgroundColor: colors.lineSoft,
            borderRadius: radius.pill,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${progress.percentagePaid}%`,
              backgroundColor: isOverdue ? colors.clay : colors.emeraldDeep,
              borderRadius: radius.pill,
            }}
          />
        </View>
        <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
          {fmt(progress.amountPaid)} paid · {fmt(progress.amountRemaining)} remaining
        </Text>
      </View>

      {/* Next payment */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: borderWidth, borderTopColor: colors.lineSoft }}>
        <Calendar size={16} color={colors.sage} strokeWidth={2} />
        <Text style={{ ...typography.caption, color: colors.sage }}>
          Next payment: {fmtDate(progress.nextDueDate)} ({getCadenceLabel(repayment_schedule.cadence)})
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function LoansScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLoans = useCallback(async () => {
    try {
      setError(null);
      const data = await loansApi.getAll();
      setLoans(data);
    } catch (e) {
      console.error('Loans load error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to load loans';
      setError(errorMessage);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    setIsLoading(true);
    loadLoans().finally(() => setIsLoading(false));
  }, [loadLoans]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    await loadLoans();
    setIsRefreshing(false);
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const goToCreate = () => {
    router.push('/(loans)/create');
  };

  const goToDetail = (loanId: string) => {
    // Bug fix (senior review, 2026-08-13): this was '/loans/detail?id=...'
    // (no parens) — the group folder is '(loans)', not 'loans', and every
    // other navigation into this same group uses the parenthesized form
    // (see goToCreate above, and the router.replace('/(loans)') calls in
    // create.tsx and detail.tsx). The un-parenthesized path doesn't resolve
    // to a real route, so tapping a loan in this list silently failed to
    // open its detail screen.
    router.push(`/(loans)/detail?id=${loanId}`);
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <ScreenContainer>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <Pressable
            onPress={goBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: spacing.xs, marginRight: spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink }}>Loans</Text>
        </View>
        <LoadingState label="Loading loans…" />
      </ScreenContainer>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScreenContainer>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.emeraldDeep} />
        }
      >
        {/* Header */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={goBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: spacing.xs, marginRight: spacing.sm, marginLeft: -spacing.xs }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
            <Text style={{ ...typography.title, color: colors.ink }}>Loans</Text>
          </View>
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
            Manage your loans and repayment schedules
          </Text>
        </View>

        {/* Create button */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Button
            fullWidth
            leftIcon={<Plus size={16} color={colors.surface} strokeWidth={2} />}
            onPress={goToCreate}
          >
            Create New Loan
          </Button>
        </View>

        {/* Error state */}
        {error && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <ErrorState message={error} onRetry={onRefresh} />
          </View>
        )}

        {/* Loans list */}
        {!error && loans.length === 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, alignItems: 'center' }}>
            <TrendingUp size={48} color={colors.sage} strokeWidth={1.5} />
            <Text style={{ ...typography.heading, color: colors.sage, marginTop: spacing.md }}>
              No loans yet
            </Text>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, textAlign: 'center' }}>
              Create your first loan to track repayments and manage your loan portfolio
            </Text>
          </View>
        )}

        {!error && loans.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            {loans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                colors={colors}
                onPress={() => goToDetail(loan.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}