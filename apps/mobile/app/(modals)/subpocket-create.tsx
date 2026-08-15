import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Minus, Plus } from 'lucide-react-native';
import { radius, spacing, typography, borderWidth, touchTarget } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader } from '@/components/ui';
import { SubPocketIcon } from '@/components/icons';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

/**
 * Create a sub-pocket nested under `parentId` (audit_team.md item 10).
 * Reachable from the Pocket Detail screen's "Sub-pockets" section.
 *
 * Input: name + splitPercentage (% of parent's monthly_allocation).
 * The API derives the cached KSh amount from the percentage — we never
 * send a raw KSh figure. We show a live KSh preview so the user can see
 * exactly what the % means in money before confirming.
 *
 * Validation: existing siblings' total % + new % must be ≤ 100. We fetch
 * the parent summary + siblings on mount to compute the remaining headroom.
 */

const PCT_STEP = 5;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function SubPocketCreateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const bump = useDataSync((s) => s.bump);
  const { parentId } = useLocalSearchParams<{ parentId: string }>();

  const [name, setName] = React.useState('');
  const [percentage, setPercentage] = React.useState(10);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Parent context loaded on mount so we can show live KSh preview
  // and enforce the sibling-sum ≤ 100% ceiling client-side.
  const [parentAllocation, setParentAllocation] = React.useState<number | null>(null);
  const [usedPercentage, setUsedPercentage] = React.useState(0);
  const [loadingParent, setLoadingParent] = React.useState(true);

  React.useEffect(() => {
    if (!parentId) return;
    let cancelled = false;
    (async () => {
      try {
        const [summary, siblings] = await Promise.all([
          pocketsApi.getSummary(parentId),
          pocketsApi.getSubPockets(parentId),
        ]);
        if (cancelled) return;
        setParentAllocation(summary.pocket.monthly_allocation ?? 0);
        const used = (siblings as any[]).reduce(
          (sum: number, s: any) => sum + (s.split_percentage ?? 0),
          0,
        );
        setUsedPercentage(round2(used));
        // Default the stepper to whatever headroom is left, capped at a
        // reasonable starting value so it doesn't pre-fill at 90%.
        const headroom = Math.max(0, 100 - round2(used));
        setPercentage(Math.min(headroom, 20));
      } catch {
        // Non-fatal — user still sees the stepper, just without KSh preview.
      } finally {
        if (!cancelled) setLoadingParent(false);
      }
    })();
    return () => { cancelled = true; };
  }, [parentId]);

  const maxPct = round2(Math.max(0, 100 - usedPercentage));
  const kshPreview =
    parentAllocation !== null ? round2((percentage / 100) * parentAllocation) : null;

  const adjust = (delta: number) => {
    setPercentage((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.max(1, Math.min(maxPct, next));
    });
  };

  const hasValidName = name.trim().length > 0;
  const hasValidPct = percentage > 0 && percentage <= maxPct;
  const canSubmit = hasValidName && hasValidPct && !submitting && !loadingParent;

  const handleCreate = async () => {
    if (!canSubmit || !parentId) return;
    setSubmitting(true);
    setError(null);
    try {
      await pocketsApi.createSubPocket(parentId, {
        name: name.trim(),
        splitPercentage: percentage,
      });
      bump();
      safeGoBack(router, '/(pockets)/detail?id=' + parentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create this sub-pocket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <BrandHeader onBack={() => safeGoBack(router, '/(pockets)/detail?id=' + parentId)} fallbackHref="/(tabs)" />
      <SafeScrollView>
        {/* ── Header ── */}
        <View style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: colors.emeraldTint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SubPocketIcon size={18} color={colors.emeraldDeep} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.title, color: colors.ink }}>New sub-pocket</Text>
            <Text style={{ ...typography.body, color: colors.sage, marginTop: 2 }}>
              Earmark a slice of this pocket for something specific.
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          {/* ── Name ── */}
          <Input
            label="Name"
            placeholder="e.g. School fees"
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoFocus
          />

          {/* ── Percentage stepper ── */}
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.ink, letterSpacing: 0.36 }}>
              Share of this pocket
            </Text>

            {/* Stepper row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderWidth,
                borderColor: colors.line,
                borderRadius: radius.md,
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={() => adjust(-PCT_STEP)}
                disabled={percentage <= 1}
                style={{
                  width: touchTarget.minWidth,
                  height: touchTarget.minHeight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: percentage <= 1 ? 0.3 : 1,
                }}
                accessibilityLabel="Decrease percentage"
                accessibilityRole="button"
              >
                <Minus size={16} color={colors.ink} strokeWidth={2} />
              </Pressable>

              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text
                  style={{
                    ...typography.title,
                    color: colors.ink,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {percentage}%
                </Text>
                {kshPreview !== null && (
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                    {formatMoney(kshPreview)} / month
                  </Text>
                )}
              </View>

              <Pressable
                onPress={() => adjust(PCT_STEP)}
                disabled={percentage >= maxPct}
                style={{
                  width: touchTarget.minWidth,
                  height: touchTarget.minHeight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: percentage >= maxPct ? 0.3 : 1,
                }}
                accessibilityLabel="Increase percentage"
                accessibilityRole="button"
              >
                <Plus size={16} color={colors.ink} strokeWidth={2} />
              </Pressable>
            </View>

            {/* Budget bar */}
            <View
              style={{
                height: 4,
                backgroundColor: colors.lineSoft,
                borderRadius: radius.pill,
                overflow: 'hidden',
              }}
            >
              {/* Already committed by siblings */}
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.min(100, usedPercentage)}%`,
                  backgroundColor: colors.sage + '60',
                  borderRadius: radius.pill,
                }}
              />
              {/* This new sub-pocket */}
              <View
                style={{
                  position: 'absolute',
                  left: `${Math.min(100, usedPercentage)}%`,
                  top: 0,
                  bottom: 0,
                  width: `${Math.min(100 - usedPercentage, percentage)}%`,
                  backgroundColor: colors.emeraldDeep,
                  borderRadius: radius.pill,
                }}
              />
            </View>

            <Text style={{ ...typography.caption, color: colors.sage }}>
              {usedPercentage > 0
                ? `${usedPercentage}% already split across siblings · ${maxPct}% available`
                : `Up to ${maxPct}% of this pocket's allocation`}
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
            disabled={!canSubmit}
            loading={submitting}
            onPress={handleCreate}
            rightIcon={<ArrowRight size={16} color={colors.surface} />}
          >
            Create sub-pocket
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}