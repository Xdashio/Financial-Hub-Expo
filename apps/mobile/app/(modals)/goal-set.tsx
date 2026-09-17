import React from 'react';
import { View, Text } from 'react-native';
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
 * Set or update the savings goal for a pocket (M7).
 *
 * The goal is a stored, user-chosen target (`pockets.savings_target_amount`,
 * API migration 039) — not the old `monthly_allocation × 12` fabrication.
 * Reaching it (ledger balance >= target) is what earns the free
 * goal_reached early unlock; with no goal set that waiver is unavailable.
 *
 * This screen deliberately does NOT edit monthly_allocation (the funding
 * rate): conflating the two was exactly the fabrication the audit flagged.
 */

const MAX_GOAL = 100_000_000;

export default function GoalSetScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const bump = useDataSync((s) => s.bump);
  const { alert } = useAlertModal();
  const { pocketId } = useLocalSearchParams<{ pocketId: string }>();

  const [targetAmount, setTargetAmount] = React.useState('');
  const [targetDate, setTargetDate] = React.useState('');
  const [currentTarget, setCurrentTarget] = React.useState<number | null>(null);
  const [currentBalance, setCurrentBalance] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pocketId) return;
    let cancelled = false;
    (async () => {
      try {
        const summary = await pocketsApi.getSummary(pocketId);
        if (cancelled) return;
        const stored = summary.pocket.savings_target_amount ?? null;
        setCurrentTarget(typeof stored === 'number' ? stored : null);
        setTargetAmount(typeof stored === 'number' && stored > 0 ? String(Math.round(stored)) : '');
        setTargetDate(summary.pocket.savings_target_date ?? '');
        setCurrentBalance(summary.summary?.available ?? null);
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

  const parsedAmount = targetAmount ? Number(targetAmount.replace(/,/g, '')) : 0;

  const handleSave = async () => {
    if (!parsedAmount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid target amount');
      return;
    }
    if (parsedAmount > MAX_GOAL) {
      setError(`Target cannot exceed KSh ${MAX_GOAL.toLocaleString()}`);
      return;
    }
    const trimmedDate = targetDate.trim();
    if (trimmedDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setError('Target date must be YYYY-MM-DD, or left empty');
      return;
    }

    if (!pocketId) return;
    setSubmitting(true);
    setError(null);
    try {
      await pocketsApi.update(pocketId, {
        savingsTargetAmount: parsedAmount,
        savingsTargetDate: trimmedDate === '' ? null : trimmedDate,
      });
      bump();
      await alert('Success', 'Your savings goal has been updated');
      safeGoBack(router, '/(pockets)/detail?id=' + pocketId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your goal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async () => {
    if (!pocketId) return;
    setSubmitting(true);
    setError(null);
    try {
      await pocketsApi.update(pocketId, { savingsTargetAmount: null, savingsTargetDate: null });
      bump();
      await alert('Success', 'Your savings goal has been cleared');
      safeGoBack(router, '/(pockets)/detail?id=' + pocketId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear your goal.');
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
          <Text style={{ ...typography.title, color: colors.ink }}>Set a savings goal</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, lineHeight: 22 }}>
            Choose the amount you are saving toward. Reaching it earns a free early unlock.
          </Text>
        </View>

        <View style={{ gap: spacing.lg }}>
          {/* ── Target amount ── */}
          <View>
            <Text style={{ ...typography.caption, color: colors.ink, letterSpacing: 0.36, marginBottom: spacing.sm }}>
              Target amount
            </Text>
            <Input
              value={targetAmount}
              onChangeText={(text) => setTargetAmount(formatAmount(text))}
              placeholder="e.g. 120,000"
              keyboardType="numeric"
              textContentType="none"
              leftElement={<Text style={{ ...typography.body, fontSize: 15, color: colors.sage }}>KSh</Text>}
              autoFocus
            />
            {currentTarget !== null && currentTarget > 0 && (
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
                Current goal: KSh {Math.round(currentTarget).toLocaleString()}
                {currentBalance !== null ? ` · saved so far: KSh ${Math.round(currentBalance).toLocaleString()}` : ''}
              </Text>
            )}
          </View>

          {/* ── Target date (optional) ── */}
          <View>
            <Text style={{ ...typography.caption, color: colors.ink, letterSpacing: 0.36, marginBottom: spacing.sm }}>
              Target date (optional)
            </Text>
            <Input
              value={targetDate}
              onChangeText={setTargetDate}
              placeholder="YYYY-MM-DD"
              textContentType="none"
            />
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

        <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          <Button
            fullWidth
            size="lg"
            disabled={!targetAmount || submitting}
            loading={submitting}
            onPress={handleSave}
            rightIcon={<ArrowRight size={16} color={colors.surface} />}
          >
            Save goal
          </Button>
          {currentTarget !== null && currentTarget > 0 && (
            <Button fullWidth size="lg" variant="secondary" disabled={submitting} onPress={handleClear}>
              Clear goal
            </Button>
          )}
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}
