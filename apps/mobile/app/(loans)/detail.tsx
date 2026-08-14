import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { radius, spacing, typography, shadow, borderWidth } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { loansApi } from '@/services/api';
import { ScreenContainer, LoadingState, ErrorState, Button, ConfirmModal } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Lock,
  Plus,
  DollarSign,
  Layers,
  AlertCircle,
  CheckCircle,
  Trash2,
} from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LoanDetail {
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
    kind: string;
    category: string | null;
    monthly_allocation: number;
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
  return formatMoney(amount);
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

function SubPocketCard({ subPocket, colors, onPress }: { subPocket: any; colors: any; onPress: () => void }) {
  const isRepayment = subPocket.name === 'Repayment';
  
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: radius.sm,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: borderWidth,
        borderColor: colors.lineSoft,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {isRepayment ? (
            <Lock size={16} color={colors.gold} strokeWidth={2} />
          ) : (
            <Layers size={16} color={colors.emeraldDeep} strokeWidth={2} />
          )}
          <Text style={{ ...typography.heading, color: colors.ink }}>
            {subPocket.name}
          </Text>
        </View>
        <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>
          {fmt(subPocket.available_balance)}
        </Text>
      </View>
      <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
        Allocated: {fmt(subPocket.monthly_allocation)}
      </Text>
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function LoanDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert, modal } = useAlertModal();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Repayment funding
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [isFunding, setIsFunding] = useState(false);

  // Purpose sub-pocket creation
  const [showPurposeModal, setShowPurposeModal] = useState(false);
  const [purposeName, setPurposeName] = useState('');
  const [purposeCategory, setPurposeCategory] = useState('');
  const [purposeAllocation, setPurposeAllocation] = useState('');
  const [isCreatingPurpose, setIsCreatingPurpose] = useState(false);

  const loadLoan = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await loansApi.getById(id);
      setLoan(data);
    } catch (e) {
      console.error('Loan detail load error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to load loan details';
      setError(errorMessage);
    }
  }, [id]);

  // Initial load
  React.useEffect(() => {
    setIsLoading(true);
    loadLoan().finally(() => setIsLoading(false));
  }, [loadLoan]);

  // Reload on focus
  useFocusEffect(
    useCallback(() => {
      loadLoan();
    }, [loadLoan])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    await loadLoan();
    setIsRefreshing(false);
  };

  const goBack = () => {
    safeGoBack(router, '/(loans)');
  };

  const handleFundRepayment = async () => {
    if (!repaymentAmount || parseFloat(repaymentAmount) <= 0) {
      await alert('Invalid Amount', 'Please enter a valid repayment amount');
      return;
    }

    if (!loan) return;

    const expectedAmount = loan.repayment_schedule.repaymentAmount;
    if (parseFloat(repaymentAmount) !== expectedAmount) {
      await alert('Amount Mismatch', `Repayment amount must be exactly ${fmt(expectedAmount)}`);
      return;
    }

    setIsFunding(true);
    try {
      await loansApi.fundRepayment(id, parseFloat(repaymentAmount));
      setShowRepaymentModal(false);
      setRepaymentAmount('');
      await loadLoan();
      await alert('Success', 'Repayment recorded successfully');
    } catch (e) {
      console.error('Fund repayment error:', e);
      // Close the Fund Repayment confirm modal before showing the error, so
      // the two ConfirmModal instances never render stacked on top of
      // each other.
      setShowRepaymentModal(false);
      await alert('Error', e instanceof Error ? e.message : 'Failed to fund repayment');
    } finally {
      setIsFunding(false);
    }
  };

  const handleCreatePurpose = async () => {
    if (!purposeName.trim()) {
      await alert('Missing Name', 'Please enter a name for the purpose sub-pocket');
      return;
    }
    if (!purposeCategory) {
      await alert('Missing Category', 'Please select a category');
      return;
    }
    if (!purposeAllocation || parseFloat(purposeAllocation) <= 0) {
      await alert('Invalid Amount', 'Please enter a valid allocation amount');
      return;
    }

    setIsCreatingPurpose(true);
    try {
      await loansApi.createPurposeSubPocket(id, {
        name: purposeName.trim(),
        category: purposeCategory,
        monthlyAllocation: parseFloat(purposeAllocation),
      });
      setShowPurposeModal(false);
      setPurposeName('');
      setPurposeCategory('');
      setPurposeAllocation('');
      await loadLoan();
      await alert('Success', 'Purpose sub-pocket created successfully');
    } catch (e) {
      console.error('Create purpose error:', e);
      // Close the Create Purpose confirm modal before showing the error, so
      // the two ConfirmModal instances never render stacked on top of
      // each other.
      setShowPurposeModal(false);
      await alert('Error', e instanceof Error ? e.message : 'Failed to create purpose sub-pocket');
    } finally {
      setIsCreatingPurpose(false);
    }
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
          <Text style={{ ...typography.title, color: colors.ink }}>Loan Details</Text>
        </View>
        <LoadingState label="Loading loan details…" />
      </ScreenContainer>
    );
  }

  if (!loan) {
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
          <Text style={{ ...typography.title, color: colors.ink }}>Loan Details</Text>
        </View>
        <ErrorState message={error || "Couldn't load loan details."} onRetry={onRefresh} />
      </ScreenContainer>
    );
  }

  const { progress, repayment_schedule, loan_provider, loan_purpose, subPockets } = loan;
  const isOverdue = progress.isOverdue;

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
          <Text style={{ ...typography.title, color: colors.ink, flex: 1 }} numberOfLines={1}>
            {loan.name}
          </Text>
          {isOverdue ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.clayTint,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
              }}
            >
              <AlertCircle size={12} color={colors.clay} strokeWidth={2} />
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.clay }}>Overdue</Text>
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.emeraldTint,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
              }}
            >
              <CheckCircle size={12} color={colors.emeraldDeep} strokeWidth={2} />
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.emeraldDeep }}>Active</Text>
            </View>
          )}
        </View>

        {/* Hero card */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <View
            style={{
              backgroundColor: colors.ink,
              borderRadius: radius.sm,
              padding: spacing.lg,
              paddingTop: spacing.xl,
              overflow: 'hidden',
              ...shadow.elevated,
            }}
          >
            <Text style={{ ...typography.caption, color: colors.surface + 'AA', marginTop: spacing.sm }}>
              Total Loan Amount
            </Text>
            <Text
              style={{
                ...typography.display,
                fontSize: 34,
                lineHeight: 42,
                color: colors.surface,
                marginTop: spacing.xs,
                fontVariant: ['tabular-nums'],
              }}
            >
              {fmt(repayment_schedule.totalAmount)}
            </Text>
            <Text style={{ ...typography.caption, color: colors.surface + '88', marginTop: 4 }}>
              {fmt(repayment_schedule.repaymentAmount)} per {getCadenceLabel(repayment_schedule.cadence)}
            </Text>

            {/* Progress bar */}
            <View
              style={{
                height: 6,
                backgroundColor: colors.surface + '22',
                borderRadius: radius.pill,
                marginTop: spacing.lg,
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

            {/* Stats row */}
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.xl }}>
              <View>
                <Text style={{ ...typography.caption, color: colors.surface + '88' }}>Paid</Text>
                <Text style={{ ...typography.heading, color: colors.surface, fontVariant: ['tabular-nums'] }}>
                  {fmt(progress.amountPaid)}
                </Text>
              </View>
              <View>
                <Text style={{ ...typography.caption, color: colors.surface + '88' }}>Remaining</Text>
                <Text style={{ ...typography.heading, color: colors.surface, fontVariant: ['tabular-nums'] }}>
                  {fmt(progress.amountRemaining)}
                </Text>
              </View>
              <View>
                <Text style={{ ...typography.caption, color: colors.surface + '88' }}>Progress</Text>
                <Text style={{ ...typography.heading, color: colors.surface }}>
                  {Math.round(progress.percentagePaid)}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Next payment */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.sm,
              padding: spacing.md,
              borderWidth: borderWidth,
              borderColor: isOverdue ? colors.clay : colors.emeraldDeep,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Calendar size={20} color={isOverdue ? colors.clay : colors.emeraldDeep} strokeWidth={2} />
              <Text style={{ ...typography.heading, color: colors.ink }}>
                Next Payment
              </Text>
            </View>
            <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm, fontVariant: ['tabular-nums'] }}>
              {fmt(repayment_schedule.repaymentAmount)}
            </Text>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
              Due: {fmtDate(progress.nextDueDate)} ({getCadenceLabel(repayment_schedule.cadence)})
            </Text>
          </View>
        </View>

        {/* Loan details */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.md }}>
            Loan Details
          </Text>
          
          {loan_provider && (
            <View style={{ marginBottom: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>Provider</Text>
              <Text style={{ ...typography.body, color: colors.ink }}>{loan_provider}</Text>
            </View>
          )}
          
          {loan_purpose && (
            <View style={{ marginBottom: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>Purpose</Text>
              <Text style={{ ...typography.body, color: colors.ink }}>{loan_purpose}</Text>
            </View>
          )}
          
          <View style={{ marginBottom: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.sage }}>Due Day</Text>
            <Text style={{ ...typography.body, color: colors.ink }}>Day {loan.due_day} of each month</Text>
          </View>
          
          <View style={{ marginBottom: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.sage }}>Repayment Schedule</Text>
            <Text style={{ ...typography.body, color: colors.ink }}>
              {progress.paymentsMade} of {progress.totalPayments} payments made
            </Text>
          </View>
        </View>

        {/* Sub-pockets */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={{ ...typography.heading, color: colors.ink }}>
              Sub-pockets
            </Text>
            <Pressable
              onPress={() => setShowPurposeModal(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
            >
              <Plus size={16} color={colors.emeraldDeep} strokeWidth={2} />
              <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                Add Purpose
              </Text>
            </Pressable>
          </View>
          
          {subPockets.length === 0 ? (
            <Text style={{ ...typography.caption, color: colors.sage }}>
              No sub-pockets yet
            </Text>
          ) : (
            subPockets.map((subPocket) => (
              <SubPocketCard
                key={subPocket.id}
                subPocket={subPocket}
                colors={colors}
                onPress={() => router.push(`/pockets/detail?id=${subPocket.id}`)}
              />
            ))
          )}
        </View>

        {/* Actions */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Button
            fullWidth
            leftIcon={<DollarSign size={16} color={colors.surface} strokeWidth={2} />}
            onPress={() => setShowRepaymentModal(true)}
          >
            Fund Repayment
          </Button>
        </View>
      </ScrollView>

      {/* Repayment modal */}
      <ConfirmModal
        visible={showRepaymentModal}
        title="Fund Repayment"
        message={`Enter repayment amount (must be exactly ${fmt(repayment_schedule.repaymentAmount)})`}
        confirmLabel="Fund"
        cancelLabel="Cancel"
        onConfirm={handleFundRepayment}
        onCancel={() => {
          setShowRepaymentModal(false);
          setRepaymentAmount('');
        }}
        loading={isFunding}
      />

      {/* Purpose sub-pocket modal */}
      <ConfirmModal
        visible={showPurposeModal}
        title="Create Purpose Sub-pocket"
        message="Create a sub-pocket for a specific loan purpose (e.g., school fees, business stock)"
        confirmLabel="Create"
        cancelLabel="Cancel"
        onConfirm={handleCreatePurpose}
        onCancel={() => {
          setShowPurposeModal(false);
          setPurposeName('');
          setPurposeCategory('');
          setPurposeAllocation('');
        }}
        loading={isCreatingPurpose}
      />
      {modal}
    </ScreenContainer>
  );
}