import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography, borderWidth } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { loansApi } from '@/services/api';
import { ScreenContainer, Button } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import {
  ArrowLeft,
  Calculator,
  Calendar,
  DollarSign,
  Info,
} from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return formatMoney(amount);
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CreateLoanScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert, modal } = useAlertModal();

  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [cadence, setCadence] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [loanProvider, setLoanProvider] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goBack = () => {
    safeGoBack(router, '/(loans)');
  };

  const validateForm = async () => {
    if (!name.trim()) {
      await alert('Missing Information', 'Please enter a loan name');
      return false;
    }
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      await alert('Invalid Amount', 'Please enter a valid total loan amount');
      return false;
    }
    if (!repaymentAmount || parseFloat(repaymentAmount) <= 0) {
      await alert('Invalid Amount', 'Please enter a valid repayment amount');
      return false;
    }
    if (parseFloat(repaymentAmount) > parseFloat(totalAmount)) {
      await alert('Invalid Amount', 'Repayment amount cannot exceed total loan amount');
      return false;
    }
    if (!startDate) {
      await alert('Missing Date', 'Please enter the start date');
      return false;
    }
    if (!endDate) {
      await alert('Missing Date', 'Please enter the end date');
      return false;
    }
    if (!dueDay || parseInt(dueDay) < 1 || parseInt(dueDay) > 31) {
      await alert('Invalid Day', 'Please enter a valid due day (1-31)');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!(await validateForm())) return;

    setIsSubmitting(true);
    try {
      await loansApi.create({
        name: name.trim(),
        totalAmount: parseFloat(totalAmount),
        repaymentAmount: parseFloat(repaymentAmount),
        cadence,
        startDate,
        endDate,
        dueDay: parseInt(dueDay),
        loanProvider: loanProvider.trim() || undefined,
        loanPurpose: loanPurpose.trim() || undefined,
      });

      await alert('Loan Created', 'Your loan has been created successfully');
      router.replace('/(loans)');
    } catch (e) {
      console.error('Create loan error:', e);
      await alert('Error', e instanceof Error ? e.message : 'Failed to create loan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScreenContainer>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
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
          <Text style={{ ...typography.title, color: colors.ink }}>Create Loan</Text>
        </View>

        {/* Form */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          {/* Loan name */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              Loan Name
            </Text>
            <TextInput
              style={{
                ...typography.body,
                color: colors.ink,
                backgroundColor: colors.surface,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderWidth: borderWidth,
                borderColor: colors.lineSoft,
              }}
              placeholder="e.g., Business Expansion Loan"
              placeholderTextColor={colors.sage}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Total amount */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              Total Loan Amount
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <DollarSign size={20} color={colors.sage} strokeWidth={2} />
              <TextInput
                style={{
                  flex: 1,
                  ...typography.body,
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  marginLeft: spacing.sm,
                  borderWidth: borderWidth,
                  borderColor: colors.lineSoft,
                  fontVariant: ['tabular-nums'],
                }}
                placeholder="0.00"
                placeholderTextColor={colors.sage}
                keyboardType="numeric"
                value={totalAmount}
                onChangeText={setTotalAmount}
              />
            </View>
          </View>

          {/* Repayment amount */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              Repayment Amount
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Calculator size={20} color={colors.sage} strokeWidth={2} />
              <TextInput
                style={{
                  flex: 1,
                  ...typography.body,
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  marginLeft: spacing.sm,
                  borderWidth: borderWidth,
                  borderColor: colors.lineSoft,
                  fontVariant: ['tabular-nums'],
                }}
                placeholder="0.00"
                placeholderTextColor={colors.sage}
                keyboardType="numeric"
                value={repaymentAmount}
                onChangeText={setRepaymentAmount}
              />
            </View>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
              Amount to pay each period
            </Text>
          </View>

          {/* Cadence */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              Repayment Cadence
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {(['weekly', 'biweekly', 'monthly'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setCadence(option)}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.sm,
                    backgroundColor: cadence === option ? colors.emeraldDeep : colors.surface,
                    borderWidth: borderWidth,
                    borderColor: cadence === option ? colors.emeraldDeep : colors.lineSoft,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: cadence === option ? colors.surface : colors.ink,
                      textAlign: 'center',
                      textTransform: 'capitalize',
                    }}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Start date */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              Start Date
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Calendar size={20} color={colors.sage} strokeWidth={2} />
              <TextInput
                style={{
                  flex: 1,
                  ...typography.body,
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  marginLeft: spacing.sm,
                  borderWidth: borderWidth,
                  borderColor: colors.lineSoft,
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.sage}
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
              When the first payment is due
            </Text>
          </View>

          {/* End date */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              End Date
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Calendar size={20} color={colors.sage} strokeWidth={2} />
              <TextInput
                style={{
                  flex: 1,
                  ...typography.body,
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  marginLeft: spacing.sm,
                  borderWidth: borderWidth,
                  borderColor: colors.lineSoft,
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.sage}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
              When the loan will be fully repaid
            </Text>
          </View>

          {/* Due day */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              Payment Due Day
            </Text>
            <TextInput
              style={{
                ...typography.body,
                color: colors.ink,
                backgroundColor: colors.surface,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderWidth: borderWidth,
                borderColor: colors.lineSoft,
                fontVariant: ['tabular-nums'],
              }}
              placeholder="e.g., 15"
              placeholderTextColor={colors.sage}
              keyboardType="numeric"
              value={dueDay}
              onChangeText={setDueDay}
            />
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
              Day of the month (1-31) when payment is due
            </Text>
          </View>

          {/* Loan provider (optional) */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              Loan Provider (Optional)
            </Text>
            <TextInput
              style={{
                ...typography.body,
                color: colors.ink,
                backgroundColor: colors.surface,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderWidth: borderWidth,
                borderColor: colors.lineSoft,
              }}
              placeholder="e.g., Equity Bank"
              placeholderTextColor={colors.sage}
              value={loanProvider}
              onChangeText={setLoanProvider}
            />
          </View>

          {/* Loan purpose (optional) */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              Loan Purpose (Optional)
            </Text>
            <TextInput
              style={{
                ...typography.body,
                color: colors.ink,
                backgroundColor: colors.surface,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderWidth: borderWidth,
                borderColor: colors.lineSoft,
                textAlignVertical: 'top',
                height: 80,
              }}
              placeholder="e.g., Business expansion, education, etc."
              placeholderTextColor={colors.sage}
              value={loanPurpose}
              onChangeText={setLoanPurpose}
              multiline
            />
          </View>

          {/* Info */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.emeraldTint, padding: spacing.md, borderRadius: radius.sm, marginTop: spacing.md }}>
            <Info size={16} color={colors.emeraldDeep} strokeWidth={2} />
            <Text style={{ ...typography.caption, color: colors.emeraldDeep, flex: 1 }}>
              A "Repayment" sub-pocket will be automatically created for tracking your loan repayments. You can create additional purpose sub-pockets after creating the loan.
            </Text>
          </View>

          {/* Submit button */}
          <View style={{ marginTop: spacing.xl }}>
            <Button
              fullWidth
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Loan...' : 'Create Loan'}
            </Button>
          </View>
        </View>
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}