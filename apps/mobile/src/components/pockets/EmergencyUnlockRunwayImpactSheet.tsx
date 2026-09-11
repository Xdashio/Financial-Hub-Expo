import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography, touchTarget, type ColorPalette } from '@/theme';
import { formatMoney } from '@/utils/money';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { PocketGlyph } from '@/components/ui/PocketGlyph';
import { PocketLoader } from '@/components/ui/PocketLoader';
import { emergencyUnlockApi } from '@/services/api';
import { DiscretionaryRunway, RunwayImpactOption, EmergencyUnlockEligibilityReason } from '@financial-hub/shared';

interface EmergencyUnlockRunwayImpactSheetProps {
  visible: boolean;
  onClose: () => void;
  onUnlock: (amount: number) => Promise<void>;
  isLoading?: boolean;
  pockets?: Array<{ id: string; name: string; kind: string; monthlyAllocation: number }>;
}

interface SpendingAnalysis {
  least_daily_spend: number;
  most_daily_spend: number;
  average_daily_spend: number;
  days_of_history: number;
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
  | { status: 'ineligible'; reason?: EmergencyUnlockEligibilityReason; message?: string; daysOfHistory?: number; minRequiredDays?: number; nextAvailable?: string }
  | { status: 'eligible'; analysis: SpendingAnalysis; discretionaryRunway: DiscretionaryRunway; runwayImpactOptions: RunwayImpactOption[] };

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function EmergencyUnlockRunwayImpactSheet({ 
  visible, 
  onClose, 
  onUnlock, 
  isLoading, 
  pockets = [] 
}: EmergencyUnlockRunwayImpactSheetProps) {
  'use no memo';
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [state, setState] = useState<EligibilityState>({ status: 'loading' });
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [amountText, setAmountText] = useState('');
  const [selectedOption, setSelectedOption] = useState<RunwayImpactOption | null>(null);
  const [showImpactWarning, setShowImpactWarning] = useState(false);

  const handleClose = () => {
    setShowImpactWarning(false);
    setSelectedOption(null);
    onClose();
  };

  const fetchEligibility = async () => {
    setState({ status: 'loading' });
    try {
      const response = await emergencyUnlockApi.checkEligibility();
      if (response.eligible && response.analysis && response.discretionary_runway && response.runway_impact_options) {
        setState({
          status: 'eligible',
          analysis: response.analysis,
          discretionaryRunway: response.discretionary_runway,
          runwayImpactOptions: response.runway_impact_options,
        });
        // Select the first option by default (10% of discretionary reserve)
        const defaultOption = response.runway_impact_options[0];
        if (defaultOption) {
          setSelectedOption(defaultOption);
          setSelectedAmount(defaultOption.emergency_amount);
          setAmountText(String(Math.round(defaultOption.emergency_amount)));
        }
      } else {
        setState({
          status: 'ineligible',
          reason: response.reason,
          message: response.message,
          daysOfHistory: response.analysis?.days_of_history,
          minRequiredDays: undefined,
          nextAvailable: response.next_available,
        });
      }
    } catch (error) {
      console.error('Failed to fetch emergency unlock eligibility:', error);
      setState({ status: 'error' });
    }
  };

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(fetchEligibility, 0);
    return () => clearTimeout(t);
  }, [visible, fetchEligibility]);

  const analysis = state.status === 'eligible' ? state.analysis : null;
  const discretionaryRunway = state.status === 'eligible' ? state.discretionaryRunway : null;
  const runwayImpactOptions = state.status === 'eligible' ? state.runwayImpactOptions : [];

  // Allocation preview proportional to depleted pockets
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

  const formatCurrency = (amount: number) => formatMoney(amount);

  // --- Loading ---
  if (state.status === 'loading') {
    return (
      <BottomSheetModal visible={visible} onClose={handleClose} title="Emergency Allocation" headerGlyph={<PocketGlyph kind="emergency" size={16} color={colors.emeraldDeep} />}>
        <View style={{ paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
          <PocketLoader size={36} color={colors.emeraldDeep} />
          <Text style={{ ...typography.body, color: colors.sage }}>Calculating spending runway impact...</Text>
        </View>
      </BottomSheetModal>
    );
  }

  // --- Error ---
  if (state.status === 'error') {
    return (
      <BottomSheetModal visible={visible} onClose={handleClose} title="Emergency Allocation" headerGlyph={<PocketGlyph kind="emergency" size={16} color={colors.emeraldDeep} />}>
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <Text style={{ ...typography.body, color: colors.ink, textAlign: 'center', marginBottom: spacing.lg }}>
            Couldn&apos;t check emergency allocation eligibility. Check your connection and try again.
          </Text>
          <Button variant="secondary" onPress={fetchEligibility}>Try again</Button>
        </View>
      </BottomSheetModal>
    );
  }

  // --- Not Eligible ---
  if (state.status === 'ineligible') {
    const isWaitingOnHistory = state.reason === 'insufficient_history';
    const isMonthlyLimit = state.reason === 'monthly_limit_reached';
    const isNotFreelancer = state.reason === 'not_freelancer_plan';
    const isNoDiscretionary = state.reason === 'no_discretionary_runway';

    return (
      <BottomSheetModal visible={visible} onClose={handleClose} title="Emergency Allocation" headerGlyph={<PocketGlyph kind="emergency" size={16} color={colors.emeraldDeep} />}>
        <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
            <PocketGlyph kind={isWaitingOnHistory ? 'spendable' : isMonthlyLimit ? 'locked' : isNotFreelancer ? 'locked' : 'savings'} size={28} color={colors.gold} />
          </View>
          <Text style={{ ...typography.body, color: colors.ink, textAlign: 'center', marginBottom: spacing.sm }}>
            {state.message ?? 'Emergency allocation is not available right now.'}
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
          {isNotFreelancer && (
            <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center', marginTop: spacing.xs }}>
              Only available for Freelancer Daily Budget plans
            </Text>
          )}
          {isNoDiscretionary && (
            <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center', marginTop: spacing.xs }}>
              Your discretionary runway is too low for an emergency allocation
            </Text>
          )}
          <Button variant="secondary" onPress={handleClose} style={{ marginTop: spacing.xl, minWidth: 140 }}>
            Got it
          </Button>
        </View>
      </BottomSheetModal>
    );
  }

  // --- Eligible: Full Runway Impact Flow ---
  return (
    <BottomSheetModal visible={visible} onClose={handleClose} title="Emergency Allocation" headerGlyph={<PocketGlyph kind="emergency" size={16} color={colors.emeraldDeep} />}>
      <ScrollView style={{ paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        {/* Analysis Summary */}
        <View style={styles.analysisCard}>
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
            <View>
              <Text style={{ ...typography.caption, color: colors.sage }}>Your daily budget</Text>
              <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                {formatCurrency(discretionaryRunway!.daily_budget)}
              </Text>
            </View>
          </View>
        </View>

        {/* Spending Runway Display */}
        <View style={styles.runwayCard}>
          <View style={styles.runwayRow}>
            <View style={styles.runwayStat}>
              <Text style={[typography.caption, { color: colors.sage }]}>Spending Runway</Text>
              <Text style={[typography.display, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                {discretionaryRunway!.runway_days}
              </Text>
              <Text style={[typography.caption, { color: colors.sage }]}>days</Text>
            </View>
            <View style={styles.runwayDivider} />
            <View style={styles.runwayStat}>
              <Text style={[typography.caption, { color: colors.sage }]}>Discretionary Reserve</Text>
              <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                {formatCurrency(discretionaryRunway!.discretionary_reserve)}
              </Text>
            </View>
            <View style={styles.runwayDivider} />
            <View style={styles.runwayStat}>
              <Text style={[typography.caption, { color: colors.sage }]}>Fixed Obligations</Text>
              <Text style={[typography.body, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                {formatCurrency(discretionaryRunway!.fixed_obligations)}
              </Text>
            </View>
          </View>
        </View>

        {/* Runway Impact Slider Options */}
        <View style={styles.section}>
          <Text style={[typography.heading, { color: colors.ink, marginBottom: spacing.sm }]}>
            Select Emergency Amount
          </Text>
          <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.md }}>
            Each option shows the impact on your spending runway
          </Text>

          {runwayImpactOptions.map((option) => {
            const isSelected = selectedOption?.emergency_amount === option.emergency_amount;
            const impactColor = option.runway_reduction_days >= 5 ? colors.clay : 
                               option.runway_reduction_days >= 3 ? colors.gold : colors.emeraldDeep;
            
            return (
              <Pressable
                key={option.emergency_amount}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                  { borderColor: isSelected ? impactColor : colors.line }
                ]}
                onPress={() => {
                  setSelectedOption(option);
                  setSelectedAmount(option.emergency_amount);
                  setAmountText(String(Math.round(option.emergency_amount)));
                  setShowImpactWarning(false);
                }}
                accessibilityRole="button"
              >
                <View style={styles.optionHeader}>
                  <Text style={[
                    typography.heading, 
                    { color: colors.ink },
                    isSelected && { color: impactColor }
                  ]}>
                    {formatCurrency(option.emergency_amount)}
                  </Text>
                  <View style={[
                    styles.impactBadge,
                    { backgroundColor: impactColor + '20' }
                  ]}>
                    <Text style={[
                      typography.caption,
                      { color: impactColor }
                    ]}>
                      -{option.runway_reduction_days} day{option.runway_reduction_days !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.optionDetails}>
                  <View style={styles.detailItem}>
                    <Text style={{ ...typography.caption, color: colors.sage }}>Before</Text>
                    <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                      {option.runway_days_before} days
                    </Text>
                  </View>
                  <View style={styles.detailArrow} />
                  <View style={styles.detailItem}>
                    <Text style={{ ...typography.caption, color: colors.sage }}>After</Text>
                    <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                      {option.runway_days_after} days
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Manual Amount Entry (optional) */}
        <View style={styles.section}>
          <Text style={[typography.heading, { color: colors.ink, marginBottom: spacing.sm }]}>
            Or enter custom amount
          </Text>
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
              onChangeText={(text) => {
                const filtered = text.replace(/[^0-9]/g, '');
                setAmountText(filtered);
                const parsed = parseInt(filtered, 10);
                if (Number.isFinite(parsed)) {
                  setSelectedAmount(parsed);
                  setShowImpactWarning(false);
                }
              }}
              onBlur={() => {
                const parsed = parseInt(amountText, 10);
                if (Number.isFinite(parsed)) {
                  setSelectedAmount(parsed);
                }
              }}
              keyboardType="number-pad"
              style={{ ...typography.heading, color: colors.emeraldDeep, flex: 1, paddingVertical: spacing.sm }}
              accessibilityLabel="Custom emergency amount"
            />
          </View>
        </View>

        {/* Selected Option Impact Summary */}
        {selectedOption && (
          <View style={[
            styles.impactSummaryCard,
            { backgroundColor: (selectedOption.runway_reduction_days >= 5 ? colors.clay : 
                                selectedOption.runway_reduction_days >= 3 ? colors.gold : colors.emeraldDeep) + '15' }
          ]}>
            <View style={styles.impactSummaryRow}>
              <View>
                <Text style={{ ...typography.caption, color: colors.sage }}>Spending Runway</Text>
                <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                  {selectedOption.runway_days_before} days
                </Text>
              </View>
              <View style={styles.arrowCenter}>
                <Text style={{ ...typography.heading, color: selectedOption.runway_reduction_days >= 5 ? colors.clay : 
                                  selectedOption.runway_reduction_days >= 3 ? colors.gold : colors.emeraldDeep }}>
                  {'\u2193'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ ...typography.caption, color: colors.sage }}>After Allocation</Text>
                <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                  {selectedOption.runway_days_after} days
                </Text>
              </View>
            </View>
            <View style={styles.impactSummaryDelta}>
              <Text style={[
                typography.body, 
                { color: selectedOption.runway_reduction_days >= 5 ? colors.clay : 
                                  selectedOption.runway_reduction_days >= 3 ? colors.gold : colors.emeraldDeep }
              ]}>
                {formatCurrency(selectedOption.emergency_amount)} will reduce your spending runway by {selectedOption.runway_reduction_days} day{selectedOption.runway_reduction_days !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Reserve & Fixed Obligations Protected */}
        <View style={styles.protectedCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <PocketGlyph kind="locked" size={16} color={colors.sage} />
            <Text style={{ ...typography.caption, color: colors.sage, flex: 1 }}>
              Fixed obligations ({formatCurrency(discretionaryRunway!.fixed_obligations)}) are protected — they will not be touched
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <PocketGlyph kind="savings" size={16} color={colors.sage} />
            <Text style={{ ...typography.caption, color: colors.sage, flex: 1 }}>
              Savings reserve maintained — emergency comes from discretionary runway only
            </Text>
          </View>
        </View>

        {/* Allocation Preview */}
        {allocations.length > 0 && (
          <View style={styles.section}>
            <Text style={[typography.heading, { color: colors.ink, marginBottom: spacing.sm }]}>
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
        <View style={styles.warningCard}>
          <AlertTriangle size={16} color={colors.gold} strokeWidth={2} />
          <Text style={{ ...typography.caption, color: colors.gold, flex: 1 }}>
            You can only use emergency allocation once per month
          </Text>
        </View>

        {/* Impact Confirmation */}
        {showImpactWarning && (
          <View style={styles.confirmCard}>
            <AlertTriangle size={16} color={colors.clay} strokeWidth={2} />
            <Text style={{ ...typography.caption, color: colors.clay, flex: 1 }}>
              {selectedOption 
                ? `Allocating ${formatCurrency(selectedOption.emergency_amount)} will reduce your spending runway by ${selectedOption.runway_reduction_days} day${selectedOption.runway_reduction_days !== 1 ? 's' : ''}. Fixed obligations remain protected.`
                : 'Please review the spending runway impact above before confirming.'
              }
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button variant="secondary" onPress={handleClose} disabled={isLoading} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onPress={() => {
              if (!showImpactWarning) {
                setShowImpactWarning(true);
                return;
              }
              onUnlock(selectedAmount);
            }} 
            loading={isLoading} 
            disabled={isLoading || !selectedOption} 
            style={{ flex: 1 }}
          >
            {showImpactWarning ? `Confirm ${formatCurrency(selectedAmount)}` : 'Review Impact'}
          </Button>
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  analysisCard: {
    backgroundColor: colors.goldTint,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  runwayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  runwayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  runwayStat: {
    alignItems: 'center',
    flex: 1,
  },
  runwayDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.lineSoft,
  },
  optionCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
  },
  optionCardSelected: {
    borderWidth: 2,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  impactBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  optionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailArrow: {
    marginHorizontal: spacing.md,
    color: colors.sage,
  },
  impactSummaryCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  impactSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  arrowCenter: {
    marginHorizontal: spacing.md,
  },
  impactSummaryDelta: {
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  protectedCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.goldTint,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  confirmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.clayTint,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.clay,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  });
}