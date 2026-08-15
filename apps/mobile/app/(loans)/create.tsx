import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { loansApi } from '@/services/api';
import { ScreenContainer, Button, Input, DatePickerSheet } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import {
  ArrowLeft,
  Calculator,
  Calendar,
  DollarSign,
  Info,
  AlertTriangle,
} from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return formatMoney(amount);
}

function formatDateDisplay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

function calculateNumberOfPayments(
  startDate: string,
  endDate: string,
  cadence: 'weekly' | 'biweekly' | 'monthly'
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  switch (cadence) {
    case 'weekly':
      return Math.floor(diffDays / 7) + 1;
    case 'biweekly':
      return Math.floor(diffDays / 14) + 1;
    case 'monthly':
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      return months + 1;
    default:
      return 1;
  }
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
  
  // Date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

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
      await alert('Missing Date', 'Please select the start date');
      return false;
    }
    if (!isValidDate(startDate)) {
      await alert('Invalid Date', 'Please select a valid start date');
      return false;
    }
    if (!endDate) {
      await alert('Missing Date', 'Please select the end date');
      return false;
    }
    if (!isValidDate(endDate)) {
      await alert('Invalid Date', 'Please select a valid end date');
      return false;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      await alert('Invalid Date Range', 'End date must be after start date');
      return false;
    }
    if (!dueDay || parseInt(dueDay) < 1 || parseInt(dueDay) > 31) {
      await alert('Invalid Day', 'Please enter a valid due day (1-31)');
      return false;
    }

    // Validate repayment schedule
    const numPayments = calculateNumberOfPayments(startDate, endDate, cadence);
    const totalRepayment = parseFloat(repaymentAmount) * numPayments;
    const totalLoan = parseFloat(totalAmount);

    if (totalRepayment !== totalLoan) {
      await alert(
        'Invalid Repayment Schedule',
        `Your repayment schedule doesn't match the loan total:\n\n${numPayments} payments of ${fmt(parseFloat(repaymentAmount))} = ${fmt(totalRepayment)}\n\nBut your loan total is ${fmt(totalLoan)}.\n\nPlease adjust the repayment amount or date range.`
      );
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
          <Input
            label="Loan Name"
            placeholder="e.g., Business Expansion Loan"
            value={name}
            onChangeText={setName}
          />

          {/* Total amount */}
          <Input
            label="Total Loan Amount"
            placeholder="0.00"
            keyboardType="numeric"
            leftElement={<DollarSign size={20} color={colors.sage} strokeWidth={2} />}
            value={totalAmount}
            onChangeText={setTotalAmount}
            helperText="Total amount borrowed"
          />

          {/* Repayment amount */}
          <Input
            label="Repayment Amount"
            placeholder="0.00"
            keyboardType="numeric"
            leftElement={<Calculator size={20} color={colors.sage} strokeWidth={2} />}
            value={repaymentAmount}
            onChangeText={setRepaymentAmount}
            helperText="Amount to pay each period"
          />

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
                    borderWidth: 1,
                    borderColor: cadence === option ? colors.emeraldDeep : colors.line,
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

          {/* Repayment Schedule Preview */}
          {startDate && endDate && repaymentAmount ? (
            <View style={{ marginBottom: spacing.lg, backgroundColor: colors.emeraldTint, padding: spacing.md, borderRadius: radius.sm }}>
              <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginBottom: spacing.xs }}>
                Repayment Schedule Preview
              </Text>
              <Text style={{ ...typography.body, color: colors.emeraldDeep }}>
                {calculateNumberOfPayments(startDate, endDate, cadence)} payments of {fmt(parseFloat(repaymentAmount))} = {fmt(parseFloat(repaymentAmount) * calculateNumberOfPayments(startDate, endDate, cadence))}
              </Text>
              {parseFloat(repaymentAmount) * calculateNumberOfPayments(startDate, endDate, cadence) !== parseFloat(totalAmount) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                  <AlertTriangle size={14} color={colors.clay} strokeWidth={2} />
                  <Text style={{ ...typography.caption, color: colors.clay }}>
                    Total doesn't match loan amount ({fmt(parseFloat(totalAmount))})
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Start date */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              Start Date
            </Text>
            <Pressable
              onPress={() => setShowStartDatePicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                minHeight: 44,
              }}
            >
              <Calendar size={20} color={colors.sage} strokeWidth={2} />
              <Text
                style={{
                  flex: 1,
                  ...typography.body,
                  color: startDate ? colors.ink : colors.sage,
                  marginLeft: spacing.sm,
                }}
              >
                {startDate ? formatDateDisplay(startDate) : 'Select start date'}
              </Text>
            </Pressable>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
              When the first payment is due
            </Text>
          </View>

          {/* End date */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              End Date
            </Text>
            <Pressable
              onPress={() => setShowEndDatePicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                minHeight: 44,
              }}
            >
              <Calendar size={20} color={colors.sage} strokeWidth={2} />
              <Text
                style={{
                  flex: 1,
                  ...typography.body,
                  color: endDate ? colors.ink : colors.sage,
                  marginLeft: spacing.sm,
                }}
              >
                {endDate ? formatDateDisplay(endDate) : 'Select end date'}
              </Text>
            </Pressable>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
              When the loan will be fully repaid
            </Text>
          </View>

          {/* Due day */}
          <Input
            label="Payment Due Day"
            placeholder="e.g., 15"
            keyboardType="numeric"
            value={dueDay}
            onChangeText={setDueDay}
            helperText="Day of the month (1-31) when payment is due"
          />

          {/* Loan provider (optional) */}
          <Input
            label="Loan Provider (Optional)"
            placeholder="e.g., Equity Bank"
            value={loanProvider}
            onChangeText={setLoanProvider}
          />

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
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderWidth: 1,
                borderColor: colors.line,
                textAlignVertical: 'top',
                minHeight: 80,
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
      
      {/* Date pickers */}
      <DatePickerSheet
        visible={showStartDatePicker}
        onClose={() => setShowStartDatePicker(false)}
        onDateSelect={setStartDate}
        initialDate={startDate}
      />
      <DatePickerSheet
        visible={showEndDatePicker}
        onClose={() => setShowEndDatePicker(false)}
        onDateSelect={setEndDate}
        initialDate={endDate}
        minDate={startDate}
      />
      
      {modal}
    </ScreenContainer>
  );
}