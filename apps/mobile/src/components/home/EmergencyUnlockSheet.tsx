import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography, touchTarget } from '@/theme';
import { formatMoney } from '@/utils/money';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { PocketGlyph } from '@/components/ui/PocketGlyph';
import { PocketLoader } from '@/components/ui/PocketLoader';
import { CategoryIcon } from '@/components/icons';
import { emergencyUnlockApi } from '@/services/api';

interface EmergencyUnlockSheetProps {
  visible: boolean;
  onClose: () => void;
  onUnlock: (amount: number) => Promise<void>;
  isLoading?: boolean;
  /** Non-savings pockets currently depleted — used to build the allocation preview. */
  pockets?: Array<{ id: string; name: string; kind: string; monthlyAllocation: number }>;
}

interface SpendingAnalysis {
  least_daily_spend: number;
  most_daily_spend: number;
  average_daily_spend: number;
  days_of_history: number;
}

interface SavingsReserve {
  total_savings: number;
  minimum_reserve: number;
  available_to_unlock: number;
}

interface AllocationPreview {
  pocket_id: string;
  pocket_name: string;
  amount: number;
  percentage: number;
}

type EligibilityState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ineligible'; reason?: string; message?: string; daysOfHistory?: number; minRequiredDays?: number; nextAvailable?: string }
  | { status: 'eligible'; analysis: SpendingAnalysis; savingsReserve: SavingsReserve };

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Emergency unlock bottom sheet for unlocking funds from savings.
 * Shows spending analysis, amount selector, and allocation preview.
 * Handles every eligibility outcome from GET /pockets/emergency-unlock/eligibility
 * (eligible, insufficient_history, monthly_limit_reached, savings_depleted, no_depleted_pockets).
 */
export function EmergencyUnlockSheet({ visible, onClose, onUnlock, isLoading, pockets = [] }: EmergencyUnlockSheetProps) {
  const { colors } = useTheme();

  const [state, setState] = useState<EligibilityState>({ status: 'loading' });
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [amountText, setAmountText] = useState('');
  const [showReserveWarning, setShowReserveWarning] = useState(false);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setShowReserveWarning(false);
    }
  }

  const fetchEligibility = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const response = await emergencyUnlockApi.checkEligibility();
      if (response.eligible && response.analysis && response.savings_reserve) {
        setState({
          status: 'eligible',
          analysis: response.analysis,
          savingsReserve: response.savings_reserve,
        });
        setSelectedAmount(response.analysis.least_daily_spend);
        setAmountText(String(Math.round(response.analysis.least_daily_spend)));
      } else {
        setState({
          status: 'ineligible',
          reason: response.reason,
          message: response.message,
          daysOfHistory: response.days_of_history,
          minRequiredDays: response.minimum_required_days,
          nextAvailable: response.next_available,
        });
      }
    } catch (error) {
      console.error('Failed to fetch emergency unlock eligibility:', error);
      setState({ status: 'error' });
    }
  }, []);

  // Fetch whenever the sheet opens. Deferred a tick so the sync
  // setState inside fetchEligibility doesn't run in the effect body.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(fetchEligibility, 0);
    return () => clearTimeout(t);
  }, [visible, fetchEligibility]);

  const analysis = state.status === 'eligible' ? state.analysis : null;
  const savingsReserve = state.status === 'eligible' ? state.savingsReserve : null;

  const daysLasting = useMemo(() => {
    if (!analysis || analysis.least_daily_spend <= 0) return 1;
    return Math.max(1, Math.floor(selectedAmount / analysis.least_daily_spend));
  }, [selectedAmount, analysis]);

  // Allocation preview, proportional to each depleted pocket's normal monthly
  // allocation — mirrors how the backend distributes the unlock (same logic
  // as regular income allocation), so the preview isn't a guess.
  const allocations: AllocationPreview[] = useMemo(() => {
    const eligiblePockets = pockets.filter((p) => p.kind !== 'savings' && p.monthlyAllocation > 0);
    const totalWeight = eligiblePockets.reduce((sum, p) => sum + p.monthlyAllocation, 0);
    if (!analysis || totalWeight <= 0) return [];
    return eligiblePockets
      .map((p) => {
        const pct = p.monthlyAllocation / totalWeight;
        return {
          pocket_id: p.id,
          pocket_name: p.name,
          amount: selectedAmount * pct,
          percentage: pct * 100,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [pockets, selectedAmount, analysis]);

  const clampAmount = useCallback(
    (value: number) => {
      if (!analysis) return value;
      return Math.min(analysis.average_daily_spend, Math.max(analysis.least_daily_spend, value));
    },
    [analysis]
  );

  const setAmount = (value: number) => {
    const clamped = clampAmount(value);
    setSelectedAmount(clamped);
    setAmountText(String(Math.round(clamped)));
    setShowReserveWarning(false);
  };

  const handleAmountTextChange = (text: string) => {
    setAmountText(text.replace(/[^0-9]/g, ''));
  };

  const handleAmountTextBlur = () => {
    const parsed = parseInt(amountText, 10);
    setAmount(Number.isFinite(parsed) ? parsed : selectedAmount);
  };

  const handleUnlock = async () => {
    if (!showReserveWarning) {
      setShowReserveWarning(true);
      return;
    }
    await onUnlock(selectedAmount);
    setShowReserveWarning(false);
  };

  const formatCurrency = (amount: number) => formatMoney(amount);

  // --- Loading ---
  if (state.status === 'loading') {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title="Emergency Unlock from Savings" headerGlyph={<PocketGlyph kind="emergency" size={16} color={colors.emeraldDeep} />}>
        <View style={{ paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
          <PocketLoader size={36} color={colors.emeraldDeep} />
          <Text style={{ ...typography.body, color: colors.sage }}>Checking eligibility…</Text>
        </View>
      </BottomSheetModal>
    );
  }

  // --- Network/unexpected error ---
  if (state.status === 'error') {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title="Emergency Unlock from Savings" headerGlyph={<PocketGlyph kind="emergency" size={16} color={colors.emeraldDeep} />}>
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <Text style={{ ...typography.body, color: colors.ink, textAlign: 'center', marginBottom: spacing.lg }}>
            Couldn&apos;t check emergency unlock eligibility. Check your connection and try again.
          </Text>
          <Button variant="secondary" onPress={fetchEligibility}>
            Try again
          </Button>
        </View>
      </BottomSheetModal>
    );
  }

  // --- Not eligible (insufficient_history / monthly_limit_reached / savings_depleted / no_depleted_pockets) ---
  if (state.status === 'ineligible') {
    const isWaitingOnHistory = state.reason === 'insufficient_history';
    const isMonthlyLimit = state.reason === 'monthly_limit_reached';
    // Same pocket-glyph family as everywhere else: "still building up" for
    // insufficient history, "sewn shut till next month" for the monthly
    // limit, and a plain savings pocket for depleted/unavailable reserves —
    // instead of a literal BarChart3 / Clock / Info picked per-case.
    const glyphKind = isWaitingOnHistory ? 'spendable' : isMonthlyLimit ? 'locked' : 'savings';

    return (
      <BottomSheetModal visible={visible} onClose={onClose} title="Emergency Unlock from Savings" headerGlyph={<PocketGlyph kind="emergency" size={16} color={colors.emeraldDeep} />}>
        <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
            <PocketGlyph kind={glyphKind} size={28} color={colors.gold} />
          </View>
          <Text style={{ ...typography.body, color: colors.ink, textAlign: 'center', marginBottom: spacing.sm }}>
            {state.message ?? 'Emergency unlock is not available right now.'}
          </Text>
          {isWaitingOnHistory && state.daysOfHistory !== undefined && state.minRequiredDays !== undefined && (
            <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center' }}>
              {state.daysOfHistory} of {state.minRequiredDays} days logged
            </Text>
          )}
          {isMonthlyLimit && formatDate(state.nextAvailable) && (
            <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center' }}>
              Next available: {formatDate(state.nextAvailable)}
            </Text>
          )}
          <Button variant="secondary" onPress={onClose} style={{ marginTop: spacing.xl, minWidth: 140 }}>
            Got it
          </Button>
        </View>
      </BottomSheetModal>
    );
  }

  // --- Eligible: full flow ---
  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Emergency Unlock from Savings" headerGlyph={<PocketGlyph kind="emergency" size={16} color={colors.emeraldDeep} />}>
      <View>
        {/* Analysis Summary */}
        <View style={{ backgroundColor: colors.goldTint, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <PocketGlyph kind="spendable" size={16} color={colors.gold} />
            <Text style={{ ...typography.heading, color: colors.gold }}>Based on your last 30 days of spending</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <View>
              <Text style={{ ...typography.caption, color: colors.sage }}>Least spent per day</Text>
              <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                {formatCurrency(analysis!.least_daily_spend)}
              </Text>
            </View>
            <View>
              <Text style={{ ...typography.caption, color: colors.sage }}>Average spent per day</Text>
              <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                {formatCurrency(analysis!.average_daily_spend)}
              </Text>
            </View>
          </View>
        </View>

        {/* Amount Selector */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
            Select amount to unlock
          </Text>
          <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.md }}>
            Between {formatCurrency(analysis!.least_daily_spend)} and {formatCurrency(analysis!.average_daily_spend)}
          </Text>

          {/* Precise entry */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.md,
              marginBottom: spacing.md,
              minHeight: touchTarget.minHeight,
            }}
          >
            <Text style={{ ...typography.body, color: colors.sage, marginRight: spacing.xs }}>KSh</Text>
            <TextInput
              value={amountText}
              onChangeText={handleAmountTextChange}
              onBlur={handleAmountTextBlur}
              keyboardType="number-pad"
              style={{ ...typography.heading, color: colors.emeraldDeep, flex: 1, paddingVertical: spacing.sm }}
              accessibilityLabel="Amount to unlock"
            />
          </View>

          {/* Step buttons for quick adjustment */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, gap: spacing.sm }}>
            <Pressable
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.sm,
                padding: spacing.md,
                alignItems: 'center',
                minHeight: touchTarget.minHeight,
                justifyContent: 'center',
              }}
              onPress={() => setAmount(selectedAmount - 100)}
              accessibilityLabel="Decrease amount by 100 shillings"
              accessibilityRole="button"
            >
              <Text style={{ ...typography.body, color: colors.ink }}>-100</Text>
            </Pressable>
            <Pressable
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.sm,
                padding: spacing.md,
                alignItems: 'center',
                minHeight: touchTarget.minHeight,
                justifyContent: 'center',
              }}
              onPress={() => setAmount(selectedAmount + 100)}
              accessibilityLabel="Increase amount by 100 shillings"
              accessibilityRole="button"
            >
              <Text style={{ ...typography.body, color: colors.ink }}>+100</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
            <Pressable onPress={() => setAmount(analysis!.least_daily_spend)} accessibilityRole="button">
              <Text style={{ ...typography.caption, color: colors.sage, textDecorationLine: 'underline' }}>
                Min {formatCurrency(analysis!.least_daily_spend)}
              </Text>
            </Pressable>
            <Pressable onPress={() => setAmount(analysis!.average_daily_spend)} accessibilityRole="button">
              <Text style={{ ...typography.caption, color: colors.sage, textDecorationLine: 'underline' }}>
                Max {formatCurrency(analysis!.average_daily_spend)}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Days Lasting Display */}
        <View style={{ backgroundColor: colors.emeraldTint, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <CategoryIcon category="emergency" size={20} />
            <Text style={{ ...typography.body, color: colors.emeraldDeep }}>
              {formatCurrency(selectedAmount)} will last you{' '}
              <Text style={{ ...typography.heading, color: colors.emeraldDeep }}>
                {daysLasting} day{daysLasting !== 1 ? 's' : ''}
              </Text>
            </Text>
          </View>
        </View>

        {/* Reserve Info */}
        <View style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <PocketGlyph kind="locked" size={16} color={colors.sage} />
            <Text style={{ ...typography.caption, color: colors.sage, flex: 1 }}>
              You&apos;ll keep {formatCurrency(savingsReserve!.minimum_reserve)} in savings reserve
            </Text>
          </View>
          <View style={{ height: 8, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                backgroundColor: colors.emeraldDeep,
                width: `${Math.min(100, (selectedAmount / Math.max(1, savingsReserve!.total_savings)) * 100)}%`,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
            <Text style={{ ...typography.caption, color: colors.sage }}>
              Unlocking: {formatCurrency(selectedAmount)}
            </Text>
            <Text style={{ ...typography.caption, color: colors.sage }}>
              Reserve: {formatCurrency(savingsReserve!.minimum_reserve)}
            </Text>
          </View>
        </View>

        {/* Allocation Preview */}
        {allocations.length > 0 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
              This will be distributed as:
            </Text>
            {allocations.map((allocation) => (
              <View
                key={allocation.pocket_id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.ink }}>{allocation.pocket_name}</Text>
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                    {allocation.percentage.toFixed(0)}%
                  </Text>
                </View>
                <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                  {formatCurrency(allocation.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Monthly Limit Warning */}
        <View style={{ backgroundColor: colors.goldTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AlertTriangle size={16} color={colors.gold} strokeWidth={2} />
          <Text style={{ ...typography.caption, color: colors.gold, flex: 1 }}>
            You can only use emergency unlock once per month
          </Text>
        </View>

        {/* Reserve Confirmation Warning */}
        {showReserveWarning && (
          <View style={{ backgroundColor: colors.clayTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AlertTriangle size={16} color={colors.clay} strokeWidth={2} />
            <Text style={{ ...typography.caption, color: colors.clay, flex: 1 }}>
              {formatCurrency(savingsReserve!.minimum_reserve)} will remain in savings as reserve. Tap &quot;Confirm unlock&quot; to proceed.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button variant="secondary" onPress={onClose} disabled={isLoading} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button variant="primary" onPress={handleUnlock} loading={isLoading} disabled={isLoading} style={{ flex: 1 }}>
            {showReserveWarning ? 'Confirm unlock' : `Unlock ${formatCurrency(selectedAmount)}`}
          </Button>
        </View>
      </View>
    </BottomSheetModal>
  );
}