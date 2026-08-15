import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Minus, Plus, AlertTriangle, Check } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography, borderWidth, touchTarget } from '@/theme';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { PocketLoader } from '@/components/ui';
import { SubPocketIcon } from '@/components/icons';
import { formatMoney } from '@/utils/money';
import { pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubPocketForRebalance {
  id: string;
  name: string;
  split_percentage: number | null;
  monthly_allocation: number;
  available_balance: number;
}

interface SubPocketRebalanceSheetProps {
  visible: boolean;
  onClose: () => void;
  /** One of the siblings (or the parent) — the service resolves the family */
  anchorPocketId: string;
  /** All current siblings, passed in from the detail screen to avoid a re-fetch */
  subPockets: SubPocketForRebalance[];
  /** Parent's monthly_allocation, used for the live KSh preview */
  parentMonthlyAllocation: number;
  /** Called after a successful rebalance so the detail screen can reload */
  onSuccess: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PCT_STEP = 5;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Rebalance bottom sheet — multi-sibling percentage editor.
 *
 * Each sub-pocket gets a +/- stepper row. Adjusting one doesn't auto-adjust
 * others (same as the onboarding CategorySplitEditor) — the user controls
 * each independently, and the total bar shows whether they're within the
 * 100% ceiling. The "Save splits" CTA is blocked when total > 100 or when
 * nothing has changed.
 *
 * When the API returns { applied: false, requiresConfirmation: true }, we
 * surface a shortfall banner and let the user confirm partial-now +
 * catch-up-next-income, or cancel.
 *
 * API endpoint: PATCH /pockets/:anchorId/rebalance
 */
export function SubPocketRebalanceSheet({
  visible,
  onClose,
  anchorPocketId,
  subPockets,
  parentMonthlyAllocation,
  onSuccess,
}: SubPocketRebalanceSheetProps) {
  const { colors } = useTheme();
  const bump = useDataSync((s) => s.bump);

  // Local draft percentages, keyed by pocket id
  const [draft, setDraft] = React.useState<Record<string, number>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Shortfall confirmation state
  const [shortfall, setShortfall] = React.useState<number | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = React.useState(false);

  // Seed draft from props whenever the sheet opens / siblings change
  React.useEffect(() => {
    if (visible) {
      const initial: Record<string, number> = {};
      for (const sp of subPockets) {
        initial[sp.id] = round2(sp.split_percentage ?? 0);
      }
      setDraft(initial);
      setError(null);
      setShortfall(null);
      setAwaitingConfirm(false);
    }
  }, [visible, subPockets]);

  const adjust = (id: string, delta: number) => {
    setError(null);
    setShortfall(null);
    setAwaitingConfirm(false);
    setDraft((prev) => {
      const current = prev[id] ?? 0;
      const next = round2(Math.max(1, Math.min(100, current + delta)));
      return { ...prev, [id]: next };
    });
  };

  const totalPct = round2(Object.values(draft).reduce((s, v) => s + v, 0));
  const isOver = totalPct > 100 + 0.01;

  const isDirty = subPockets.some((sp) => {
    const original = round2(sp.split_percentage ?? 0);
    const current = draft[sp.id] ?? original;
    return Math.abs(current - original) > 0.01;
  });

  const canSave = isDirty && !isOver && !saving;

  const buildSplits = () =>
    subPockets.map((sp) => ({
      pocketId: sp.id,
      splitPercentage: draft[sp.id] ?? round2(sp.split_percentage ?? 0),
    }));

  const doSave = async (confirmPartial: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const result = await pocketsApi.rebalanceSubPockets(
        anchorPocketId,
        buildSplits(),
        confirmPartial,
      ) as any;

      if (result?.applied === false && result?.requiresConfirmation) {
        // API says there's not enough money to fully fund the change right
        // now — surface the shortfall and ask the user to confirm partial.
        setShortfall(round2(result.shortfall ?? 0));
        setAwaitingConfirm(true);
        setSaving(false);
        return;
      }

      // Success
      bump();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the new splits.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => doSave(false);
  const handleConfirmPartial = () => doSave(true);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={handleClose}
      title="Rebalance sub-pockets"
      headerGlyph={<SubPocketIcon size={16} color={colors.emeraldDeep} strokeWidth={2} />}
    >
      {/* ── Intro ── */}
      <Text style={{ ...typography.body, color: colors.sage, marginBottom: spacing.lg, lineHeight: 20 }}>
        Adjust what share of this pocket each sub-pocket earmarks. Changes take
        effect immediately from the current balances.
      </Text>

      {/* ── Sibling rows ── */}
      <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
        {subPockets.map((sp) => {
          const pct = draft[sp.id] ?? round2(sp.split_percentage ?? 0);
          const ksh = round2((pct / 100) * parentMonthlyAllocation);
          const originalPct = round2(sp.split_percentage ?? 0);
          const changed = Math.abs(pct - originalPct) > 0.01;

          return (
            <View
              key={sp.id}
              style={{
                backgroundColor: colors.surface,
                borderWidth,
                borderColor: changed ? colors.emeraldDeep + '60' : colors.line,
                borderRadius: radius.sm,
                padding: spacing.md,
              }}
            >
              {/* Pocket name + change indicator */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                <Text
                  style={{ ...typography.heading, color: colors.ink, flex: 1 }}
                  numberOfLines={1}
                >
                  {sp.name}
                </Text>
                {changed && (
                  <View
                    style={{
                      backgroundColor: colors.emeraldTint,
                      borderRadius: radius.pill,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                      {originalPct}% → {pct}%
                    </Text>
                  </View>
                )}
              </View>

              {/* Stepper */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.lineSoft + '50',
                  borderRadius: radius.xs,
                  overflow: 'hidden',
                }}
              >
                <Pressable
                  onPress={() => adjust(sp.id, -PCT_STEP)}
                  disabled={pct <= 1 || saving}
                  style={{
                    width: touchTarget.minWidth,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pct <= 1 || saving ? 0.3 : 1,
                  }}
                  accessibilityLabel={`Decrease ${sp.name} percentage`}
                  accessibilityRole="button"
                >
                  <Minus size={16} color={colors.ink} strokeWidth={2} />
                </Pressable>

                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text
                    style={{
                      ...typography.heading,
                      color: colors.ink,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {pct}%
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                    {formatMoney(ksh)} / month
                  </Text>
                </View>

                <Pressable
                  onPress={() => adjust(sp.id, PCT_STEP)}
                  disabled={pct >= 100 || saving}
                  style={{
                    width: touchTarget.minWidth,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pct >= 100 || saving ? 0.3 : 1,
                  }}
                  accessibilityLabel={`Increase ${sp.name} percentage`}
                  accessibilityRole="button"
                >
                  <Plus size={16} color={colors.ink} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Total bar ── */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth,
          borderColor: colors.line,
          borderRadius: radius.sm,
          padding: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.sage }}>Total split</Text>
          <Text
            style={{
              ...typography.caption,
              color: isOver ? colors.clay : totalPct === 100 ? colors.emeraldDeep : colors.ink,
              fontVariant: ['tabular-nums'],
            }}
          >
            {totalPct}% / 100%
          </Text>
        </View>

        {/* Progress bar */}
        <View
          style={{
            height: 6,
            backgroundColor: colors.lineSoft,
            borderRadius: radius.pill,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${Math.min(100, totalPct)}%`,
              backgroundColor: isOver
                ? colors.clay
                : totalPct === 100
                ? colors.emeraldDeep
                : colors.emerald,
              borderRadius: radius.pill,
            }}
          />
        </View>

        {isOver && (
          <Text style={{ ...typography.caption, color: colors.clay, marginTop: spacing.xs }}>
            Over 100% — reduce one or more sub-pockets before saving.
          </Text>
        )}
        {!isOver && totalPct < 100 && (
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
            {round2(100 - totalPct)}% stays in the parent as a reserved buffer.
          </Text>
        )}
        {!isOver && totalPct === 100 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
            <Check size={12} color={colors.emeraldDeep} strokeWidth={2.5} />
            <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
              Fully split
            </Text>
          </View>
        )}
      </View>

      {/* ── Shortfall confirmation ── */}
      {awaitingConfirm && shortfall !== null && (
        <View
          style={{
            backgroundColor: colors.goldTint,
            borderRadius: radius.sm,
            borderWidth,
            borderColor: colors.gold + '40',
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <AlertTriangle size={15} color={colors.gold} strokeWidth={2} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.gold, marginBottom: spacing.xs }}>
                Not enough to fully rebalance right now
              </Text>
              <Text style={{ ...typography.caption, color: colors.gold + 'CC', lineHeight: 18 }}>
                {formatMoney(shortfall)} more is needed than is currently available. Apply what's
                possible now — the rest will catch up automatically at your next income event.
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Button
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => { setAwaitingConfirm(false); setShortfall(null); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              style={{ flex: 1 }}
              loading={saving}
              onPress={handleConfirmPartial}
            >
              Apply now
            </Button>
          </View>
        </View>
      )}

      {/* ── General error ── */}
      {!!error && (
        <View
          style={{
            backgroundColor: colors.clayTint,
            borderRadius: radius.sm,
            borderWidth,
            borderColor: colors.clay + '30',
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <Text style={{ ...typography.caption, color: colors.clay, lineHeight: 18 }}>{error}</Text>
        </View>
      )}

      {/* ── CTA ── */}
      {!awaitingConfirm && (
        <Button
          fullWidth
          size="lg"
          disabled={!canSave}
          loading={saving}
          onPress={handleSave}
          leftIcon={saving ? <PocketLoader size={20} color={colors.surface} /> : undefined}
        >
          Save splits
        </Button>
      )}
    </BottomSheetModal>
  );
}