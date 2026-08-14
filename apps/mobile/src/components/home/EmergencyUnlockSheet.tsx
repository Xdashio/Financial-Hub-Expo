import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, AlertTriangle, TrendingUp, PiggyBank, Info } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography, touchTarget } from '@/theme';
import { formatMoney } from '@/utils/money';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { emergencyUnlockApi } from '@/services/api';

interface EmergencyUnlockSheetProps {
  visible: boolean;
  onClose: () => void;
  onUnlock: (amount: number) => Promise<void>;
  isLoading?: boolean;
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

/**
 * Emergency unlock bottom sheet for unlocking funds from savings.
 * Shows spending analysis, amount selector, and allocation preview.
 */
export function EmergencyUnlockSheet({ visible, onClose, onUnlock, isLoading }: EmergencyUnlockSheetProps) {
  const { colors } = useTheme();
  
  const [analysis, setAnalysis] = useState<SpendingAnalysis | null>(null);
  const [savingsReserve, setSavingsReserve] = useState<SavingsReserve | null>(null);
  const [selectedAmount, setSelectedAmount] = useState(500);
  const [daysLasting, setDaysLasting] = useState(1);
  const [showReserveWarning, setShowReserveWarning] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [allocations, setAllocations] = useState<AllocationPreview[]>([]);

  // Fetch eligibility data when sheet opens
  useEffect(() => {
    if (visible) {
      fetchEligibility();
    }
  }, [visible]);

  const fetchEligibility = async () => {
    setIsLoadingData(true);
    try {
      const response = await emergencyUnlockApi.checkEligibility();
      if (response.eligible && response.analysis && response.savings_reserve) {
        setAnalysis(response.analysis);
        setSavingsReserve(response.savings_reserve);
        setSelectedAmount(response.analysis.least_daily_spend);
      }
    } catch (error) {
      console.error('Failed to fetch eligibility:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Update days lasting when amount changes
  useEffect(() => {
    if (analysis) {
      const days = Math.floor(selectedAmount / analysis.least_daily_spend);
      setDaysLasting(Math.max(1, days));
      
      // Update allocations preview (mocked for now, would come from API)
      if (savingsReserve) {
        const totalAllocation = 4000; // Mock: Food: 3000 + Transport: 1000
        const foodPct = 3000 / totalAllocation;
        const transportPct = 1000 / totalAllocation;
        
        setAllocations([
          {
            pocket_id: 'pocket-food',
            pocket_name: 'Food & Groceries',
            amount: selectedAmount * foodPct,
            percentage: foodPct * 100,
          },
          {
            pocket_id: 'pocket-transport',
            pocket_name: 'Transport',
            amount: selectedAmount * transportPct,
            percentage: transportPct * 100,
          },
        ]);
      }
    }
  }, [selectedAmount, analysis, savingsReserve]);

  const handleUnlock = async () => {
    if (!showReserveWarning) {
      setShowReserveWarning(true);
      return;
    }
    
    await onUnlock(selectedAmount);
    setShowReserveWarning(false);
    onClose();
  };

  const formatCurrency = (amount: number) => formatMoney(amount);

  if (isLoadingData) {
    return (
      <BottomSheetModal
        visible={visible}
        onClose={onClose}
        title="Emergency Unlock from Savings"
        headerIcon={AlertTriangle}
      >
        <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
          <Text style={{ ...typography.body, color: colors.sage }}>Loading...</Text>
        </View>
      </BottomSheetModal>
    );
  }

  if (!analysis || !savingsReserve) {
    return (
      <BottomSheetModal
        visible={visible}
        onClose={onClose}
        title="Emergency Unlock from Savings"
        headerIcon={AlertTriangle}
      >
        <View style={{ padding: spacing.lg }}>
          <Text style={{ ...typography.body, color: colors.ink }}>
            {analysis ? 'Not eligible for emergency unlock. ' + (analysis.message || '') : 'Unable to load eligibility data.'}
          </Text>
        </View>
      </BottomSheetModal>
    );
  }

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Emergency Unlock from Savings"
      headerIcon={AlertTriangle}
    >
      <ScrollView style={{ padding: spacing.lg }}>
        {/* Analysis Summary */}
        <View style={{ backgroundColor: colors.goldTint, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <TrendingUp size={16} color={colors.gold} strokeWidth={2} />
            <Text style={{ ...typography.heading, color: colors.gold }}>Based on your last 30 days of spending</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <View>
              <Text style={{ ...typography.caption, color: colors.sage }}>Least spent per day</Text>
              <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                {formatCurrency(analysis.least_daily_spend)}
              </Text>
            </View>
            <View>
              <Text style={{ ...typography.caption, color: colors.sage }}>Average spent per day</Text>
              <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                {formatCurrency(analysis.average_daily_spend)}
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
            Between {formatCurrency(analysis.least_daily_spend)} and {formatCurrency(analysis.average_daily_spend)}
          </Text>
          
          {/* Step buttons for amount selection */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Pressable
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.sm,
                padding: spacing.md,
                alignItems: 'center',
                marginRight: spacing.sm,
              }}
              onPress={() => setSelectedAmount(Math.max(analysis.least_daily_spend, selectedAmount - 100))}
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
                marginLeft: spacing.sm,
              }}
              onPress={() => setSelectedAmount(Math.min(analysis.average_daily_spend, selectedAmount + 100))}
            >
              <Text style={{ ...typography.body, color: colors.ink }}>+100</Text>
            </Pressable>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.sage }}>
              {formatCurrency(analysis.least_daily_spend)}
            </Text>
            <Text style={{ ...typography.heading, color: colors.emeraldDeep, fontVariant: ['tabular-nums'] }}>
              {formatCurrency(selectedAmount)}
            </Text>
            <Text style={{ ...typography.caption, color: colors.sage }}>
              {formatCurrency(analysis.average_daily_spend)}
            </Text>
          </View>
        </View>

        {/* Days Lasting Display */}
        <View style={{ backgroundColor: colors.emeraldTint, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <PiggyBank size={20} color={colors.emeraldDeep} strokeWidth={2} />
            <Text style={{ ...typography.body, color: colors.emeraldDeep }}>
              {formatCurrency(selectedAmount)} will last you <Text style={{ ...typography.heading, color: colors.emeraldDeep }}>{daysLasting} day{daysLasting !== 1 ? 's' : ''}</Text>
            </Text>
          </View>
        </View>

        {/* Reserve Info */}
        <View style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Info size={16} color={colors.sage} strokeWidth={2} />
            <Text style={{ ...typography.caption, color: colors.sage }}>
              You'll keep {formatCurrency(savingsReserve.minimum_reserve)} in savings reserve
            </Text>
          </View>
          <View style={{ height: 8, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                backgroundColor: colors.emeraldDeep,
                width: `${(selectedAmount / savingsReserve.total_savings) * 100}%`,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
            <Text style={{ ...typography.caption, color: colors.sage }}>
              Unlocking: {formatCurrency(selectedAmount)}
            </Text>
            <Text style={{ ...typography.caption, color: colors.sage }}>
              Reserve: {formatCurrency(savingsReserve.minimum_reserve)}
            </Text>
          </View>
        </View>

        {/* Allocation Preview */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
            This will be distributed as:
          </Text>
          {allocations.map((allocation) => (
            <View key={allocation.pocket_id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
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
              {formatCurrency(savingsReserve.minimum_reserve)} will remain in savings as reserve
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button
            variant="secondary"
            onPress={onClose}
            style={{ flex: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onPress={handleUnlock}
            disabled={isLoading}
            style={{ flex: 1 }}
          >
            {isLoading ? 'Processing...' : `Unlock ${formatCurrency(selectedAmount)}`}
          </Button>
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
}
