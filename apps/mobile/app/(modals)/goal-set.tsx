import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { radius, spacing, typography, borderWidth } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader } from '@/components/ui';
import { safeGoBack } from '@/utils/navigation';
import { useAlertModal } from '@/hooks/useAlertModal';

/**
 * Set or update a savings goal for a pocket.
 * 
 * Currently, the goal is calculated as monthly_allocation * 12 (annual target).
 * This modal allows users to adjust their monthly allocation, which effectively
 * changes their annual goal target.
 * 
 * TODO: When a dedicated goal-setting API exists, this should be updated to
 * set goal_amount, goal_timeframe, etc. as separate entities.
 */

export default function GoalSetScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const bump = useDataSync((s) => s.bump);
  const { alert } = useAlertModal();
  const { pocketId } = useLocalSearchParams<{ pocketId: string }>();

  const [monthlyAllocation, setMonthlyAllocation] = React.useState('');
  const [currentAllocation, setCurrentAllocation] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pocketId) return;
    let cancelled = false;
    (async () => {
      try {
        const summary = await pocketsApi.getSummary(pocketId);
        if (cancelled) return;
        setCurrentAllocation(summary.pocket.monthly_allocation ?? 0);
        setMonthlyAllocation(String(summary.pocket.monthly_allocation ?? 0));
      } catch {
        // Non-fatal — user can still enter a value
      }
    })();
    return () => { cancelled = true; };
  }, [pocketId]);

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, '');
    if (!cleaned) return '';
    return Number(cleaned).toLocaleString();
  };

  const annualGoal = monthlyAllocation ? Number(monthlyAllocation.replace(/,/g, '')) * 12 : 0;

  const handleSave = async () => {
    const amount = Number(monthlyAllocation.replace(/,/g, ''));
    if (!amount || amount <= 0) {
      setError('Please enter a valid monthly allocation');
      return;
    }

    if (!pocketId) return;
    setSubmitting(true);
    setError(null);
    try {
      await pocketsApi.update(pocketId, { monthly_allocation: amount });
      bump();
      await alert('Success', 'Your goal has been updated');
      safeGoBack(router, '/(pockets)/detail?id=' + pocketId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your goal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <BrandHeader onBack={() => safeGoBack(router, '/(pockets)/detail?id=' + pocketId)} fallbackHref="/(tabs)" />
      <SafeScrollView>
        {/* ── Header ── */}
        <View style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.title, color: colors.ink }}>Set a new goal</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, lineHeight: 22 }}>
            Adjust your monthly savings allocation to set a new annual target.
          </Text>
        </View>

        <View style={{ gap: spacing.lg }}>
          {/* ── Monthly Allocation ── */}
          <View>
            <Text style={{ ...typography.caption, color: colors.ink, letterSpacing: 0.36, marginBottom: spacing.sm }}>
              Monthly allocation
            </Text>
            <Input
              value={monthlyAllocation}
              onChangeText={(text) => setMonthlyAllocation(formatAmount(text))}
              placeholder="e.g. 10,000"
              keyboardType="numeric"
              textContentType="none"
              leftElement={<Text style={{ ...typography.body, fontSize: 15, color: colors.sage }}>KSh</Text>}
              autoFocus
            />
            {currentAllocation !== null && (
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
                Current: KSh {currentAllocation.toLocaleString()} / month
              </Text>
            )}
          </View>

          {/* ── Annual Goal Preview ── */}
          <View
            style={{
              backgroundColor: colors.emeraldTint,
              borderRadius: radius.sm,
              borderWidth,
              borderColor: colors.emeraldDeep + '30',
              padding: spacing.lg,
            }}
          >
            <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginBottom: spacing.xs }}>
              Annual goal target
            </Text>
            <Text style={{ ...typography.display, color: colors.emeraldDeep, fontVariant: ['tabular-nums'] }}>
              KSh {annualGoal.toLocaleString()}
            </Text>
            <Text style={{ ...typography.caption, color: colors.emeraldDeep + 'AA', marginTop: spacing.xs }}>
              {monthlyAllocation ? 'Based on your monthly allocation × 12' : 'Enter a monthly allocation above'}
            </Text>
          </View>
        </View>

        {/* ── Error ── */}
        {!!error && (
          <View
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.clayTint,
              borderRadius: radius.sm,
              borderWidth,
              borderColor: colors.clay + '30',
              padding: spacing.md,
            }}
          >
            <Text style={{ ...typography.caption, color: colors.clay, lineHeight: 18 }}>{error}</Text>
          </View>
        )}

        <View style={{ marginTop: spacing.xxl }}>
          <Button
            fullWidth
            size="lg"
            disabled={!monthlyAllocation || submitting}
            loading={submitting}
            onPress={handleSave}
            rightIcon={<ArrowRight size={16} color={colors.surface} />}
          >
            Save goal
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}
