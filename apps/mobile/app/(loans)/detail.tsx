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
import { ScreenContainer, LoadingState, ErrorState, Button, Input } from '@/components/ui';
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
  const { alert, confirm, modal } = useAlertModal();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Repayment funding
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [isFunding, setIsFunding] = useState(false);

  // Purpose sub-pocket creation
  const [showPurposeForm, setShowPurposeForm] = useState(false);
  const [purposeName, setPurposeName] = useState('');
  const [purposeCategory, setPurposeCategory] = useState('');
  const [purposeSplitPercentage, setPurposeSplitPercentage] = useState('');
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
      // Provide a more helpful error message if it's a pocket vs loan issue
      if (errorMessage.includes('not a loan') || errorMessage.includes('Pocket is not a loan')) {
        setError('This is not a loan pocket. Please navigate to the pocket detail screen instead.');
      } else {
        setError(errorMessage);
      }
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

  const handleRepaymentConfirm = async () => {
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

    const confirmed = await confirm(
      'Fund Repayment',
      `Transfer ${fmt(parseFloat(repaymentAmount))} to your repayment pocket?`
    );
    if (!confirmed) return;
    handleFundRepayment();
  };

  const handlePurposeConfirm = async () => {
    if (!purposeName.trim()) {
      await alert('Missing Name', 'Please enter a name for the purpose sub-pocket');
      return;
    }
    if (!purposeCategory) {
      await alert('Missing Category', 'Please select a category');
      return;
    }
    if (!purposeSplitPercentage || parseFloat(purposeSplitPercentage) <= 0) {
      await alert('Invalid Percentage', 'Please enter a valid split percentage (0-100)');
      return;
    }
    if (parseFloat(purposeSplitPercentage) > 100) {
      await alert('Invalid Percentage', 'Split percentage cannot exceed 100%');
      return;
    }

    const confirmed = await confirm(
      'Create Purpose Sub-pocket',
      `Create "${purposeName.trim()}" with ${purposeSplitPercentage}% of the loan amount?`
    );
    if (!confirmed) return;
    handleCreatePurpose();
  };

  const handleFundRepayment = async () => {
    setIsFunding(true);
    try {
      await loansApi.fundRepayment(id, parseFloat(repaymentAmount));
      setRepaymentAmount('');
      await loadLoan();
      await alert('Success', 'Repayment recorded successfully');
    } catch (e) {
      console.error('Fund repayment error:', e);
      await alert('Error', e instanceof Error ? e.message : 'Failed to fund repayment');
    } finally {
      setIsFunding(false);
    }
  };

  const handleCreatePurpose = async () => {
    setIsCreatingPurpose(true);
    try {
      await loansApi.createPurposeSubPocket(id, {
        name: purposeName.trim(),
        category: purposeCategory,
        splitPercentage: parseFloat(purposeSplitPercentage),
      });
      setPurposeName('');
      setPurposeCategory('');
      setPurposeSplitPercentage('');
      await loadLoan();
      await alert('Success', 'Purpose sub-pocket created successfully');
    } catch (e) {
      console.error('Create purpose error:', e);
      await alert('Error', e instanceof Error ? e.message : 'Failed to create purpose sub-pocket');
    } finally {
      setIsCreatingPurpose(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <ScreenContainer>
        {modal}
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
        <LoadingState label="Loading loan details…" variant="cards" />
      </ScreenContainer>
    );
  }

  if (!loan) {
    return (
      <ScreenContainer>
        {modal}
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
  const repaymentSubPocket = subPockets?.find(sp => sp.name === 'Repayment');

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
              onPress={() => setShowPurposeForm(!showPurposeForm)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
            >
              <Plus size={16} color={colors.emeraldDeep} strokeWidth={2} />
              <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                {showPurposeForm ? 'Cancel' : 'Add Purpose'}
              </Text>
            </Pressable>
          </View>
          
          {/* Purpose creation form */}
          {showPurposeForm && (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.md, borderWidth: borderWidth, borderColor: colors.line }}>
              <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.md }}>
                Create Purpose Sub-pocket
              </Text>
              
              <Input
                label="Purpose Name"
                placeholder="e.g., School Fees, Business Stock"
                value={purposeName}
                onChangeText={setPurposeName}
                helperText="What this sub-pocket is for"
              />
              
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
                  Category
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {['food', 'transport', 'leisure', 'personal', 'utilities', 'healthcare', 'education', 'housing', 'family', 'other'].map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setPurposeCategory(cat)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.pill,
                        backgroundColor: purposeCategory === cat ? colors.emeraldDeep : colors.lineSoft,
                        borderWidth: 1,
                        borderColor: purposeCategory === cat ? colors.emeraldDeep : colors.line,
                      }}
                    >
                      <Text style={{ 
                        ...typography.caption, 
                        color: purposeCategory === cat ? colors.surface : colors.ink,
                        textTransform: 'capitalize'
                      }}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              
              <Input
                label="Split Percentage"
                placeholder="0-100"
                keyboardType="numeric"
                value={purposeSplitPercentage}
                onChangeText={setPurposeSplitPercentage}
                helperText="Percentage of loan amount to allocate to this purpose (0-100%)"
              />
              
              <Button
                fullWidth
                onPress={handlePurposeConfirm}
                disabled={isCreatingPurpose}
                style={{ marginTop: spacing.md }}
              >
                {isCreatingPurpose ? 'Creating...' : 'Create Purpose'}
              </Button>
            </View>
          )}
          
          {subPockets.length === 0 && !showPurposeForm ? (
            <Text style={{ ...typography.caption, color: colors.sage }}>
              No sub-pockets yet. Tap "Add Purpose" to create one.
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

        {/* Fund Repayment - only show if repayment sub-pocket exists */}
        {repaymentSubPocket && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.md }}>
              Fund Repayment
            </Text>

            <View style={{ backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.md, borderWidth: borderWidth, borderColor: colors.line }}>
              <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.sm }}>
                Required amount: {fmt(loan?.repayment_schedule?.repaymentAmount || 0)}
              </Text>

              <Input
                label="Repayment Amount"
                placeholder={fmt(loan?.repayment_schedule?.repaymentAmount || 0)}
                keyboardType="numeric"
                leftElement={<DollarSign size={20} color={colors.sage} strokeWidth={2} />}
                value={repaymentAmount}
                onChangeText={setRepaymentAmount}
                helperText="Enter the exact repayment amount"
              />

              <Button
                fullWidth
                leftIcon={<DollarSign size={16} color={colors.surface} strokeWidth={2} />}
                onPress={handleRepaymentConfirm}
                disabled={isFunding}
                style={{ marginTop: spacing.md }}
              >
                {isFunding ? 'Processing...' : 'Fund Repayment'}
              </Button>
            </View>
          </View>
        )}

        {/* Show message if repayment sub-pocket doesn't exist */}
        {!repaymentSubPocket && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <View style={{ backgroundColor: colors.emeraldTint, borderRadius: radius.sm, padding: spacing.md, borderWidth: borderWidth, borderColor: colors.emeraldDeep }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <AlertCircle size={20} color={colors.emeraldDeep} strokeWidth={2} />
                <Text style={{ ...typography.heading, color: colors.emeraldDeep }}>
                  Repayment Pocket Not Set Up
                </Text>
              </View>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.sm }}>
                A repayment sub-pocket is required to fund repayments. Please create it via the backend or contact support.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}