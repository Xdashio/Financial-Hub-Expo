import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Clock, AlertTriangle } from 'lucide-react-native';
import { colors, radius, spacing, typography, borderWidth, borderWidthThick } from '@/theme';
import { useHomeStore } from '@/services/home-store';
import { reallocationsApi } from '@/services/api';
import { showAlert } from '@/utils/alert';
import { Button, Card, ScreenContainer, SafeScrollView, BrandHeader, SectionTitle } from '@/components/ui';

type ReviewParams = {
  fromId: string;
  toId: string;
  amount: string;
};

const REASONS: { value: string; label: string }[] = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'unexpected_expense', label: 'Unexpected expense' },
  { value: 'income_change', label: 'Income change' },
  { value: 'priority_shift', label: 'Priority shift' },
  { value: 'other', label: 'Other' },
];

function formatCurrency(amount: number) {
  return `KES ${Math.round(amount).toLocaleString()}`;
}

function isSameMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function ReallocReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<ReviewParams>();
  const pockets = useHomeStore((s) => s.pockets);

  const fromPocket = pockets.find((p) => p.id === params.fromId) || null;
  const toPocket = pockets.find((p) => p.id === params.toId) || null;
  const amount = Number(params.amount) || 0;

  const [reason, setReason] = React.useState('other');
  const [frequentMoveCount, setFrequentMoveCount] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    reallocationsApi
      .getAll()
      .then((all) => {
        if (cancelled) return;
        const count = (all || []).filter(
          (r: any) => r.from_pocket_id === params.fromId && r.created_at && isSameMonth(r.created_at)
        ).length;
        setFrequentMoveCount(count);
      })
      .catch(() => {
        // Non-critical — the friction note is a nice-to-have, not a blocker.
      });
    return () => {
      cancelled = true;
    };
  }, [params.fromId]);

  // Client-side hint only — the server makes the authoritative cooling-off
  // decision. Mirrors ReallocationsService.isEssential/isLeisure.
  const coolingOffLikely =
    !!fromPocket &&
    !!toPocket &&
    (fromPocket.kind === 'fixed' || fromPocket.category === 'food') &&
    toPocket.category === 'leisure';

  const handleConfirm = async () => {
    if (!fromPocket || !toPocket || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const created = await reallocationsApi.create({
        fromPocketId: fromPocket.id,
        toPocketId: toPocket.id,
        amount,
        reason,
      });

      if (created.status === 'cooling_off') {
        router.replace({
          pathname: '/(modals)/realloc-cooloff',
          params: {
            reallocationId: created.id,
            coolingOffEndsAt: created.cooling_off_ends_at,
            fromName: fromPocket.name,
            toName: toPocket.name,
            amount: String(amount),
          },
        });
        return;
      }

      // status === 'pending' — nothing blocks it, complete immediately.
      const completed = await reallocationsApi.complete(created.id, {});
      router.replace({
        pathname: '/(modals)/realloc-success',
        params: {
          fromName: fromPocket.name,
          toName: toPocket.name,
          amount: String(amount),
          reasonLabel: REASONS.find((r) => r.value === reason)?.label || 'Other',
          newFromBalance: String(Math.max(0, fromPocket.monthlyAllocation - amount)),
        },
      });
    } catch (err) {
      showAlert('Could not move that money', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!fromPocket || !toPocket) {
    return (
      <ScreenContainer>
        <BrandHeader onBack={() => router.canGoBack() && router.back()} />
        <SafeScrollView>
          <Text style={styles.subtext}>This reallocation is missing pocket details — go back and pick again.</Text>
        </SafeScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <BrandHeader onBack={() => router.canGoBack() && router.back()} />
      <SafeScrollView>
        <Text style={styles.title}>Review reallocation</Text>

        <View style={styles.flowRow}>
          <View style={styles.flowPocket}>
            <Text style={styles.flowName}>{fromPocket.name}</Text>
            <Text style={styles.flowAmt}>{formatCurrency(fromPocket.monthlyAllocation)}</Text>
          </View>
          <ArrowRight size={18} color={colors.sage} />
          <View style={[styles.flowPocket, styles.flowPocketTo]}>
            <Text style={styles.flowName}>{toPocket.name}</Text>
            <Text style={styles.flowAmt}>{formatCurrency(toPocket.monthlyAllocation)}</Text>
          </View>
        </View>

        <Card style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <Text style={styles.moveLabel}>Amount to move</Text>
          <Text style={styles.moveValue}>{formatCurrency(amount)}</Text>
        </Card>

        <SectionTitle>Why are you moving this?</SectionTitle>
        <View style={styles.chipRow}>
          {REASONS.map((r) => (
            <TouchableOpacity
              key={r.value}
              onPress={() => setReason(r.value)}
              style={[styles.chip, reason === r.value && styles.chipSelected]}
            >
              <Text style={[styles.chipText, reason === r.value && styles.chipTextSelected]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {coolingOffLikely && (
          <View style={styles.noteCard}>
            <Clock size={16} color={colors.plum} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noteTitle}>Cooling-off applies to this move</Text>
              <Text style={styles.noteBody}>
                Moves from essential pockets into leisure are held for a bit. You'll see a pause screen after
                confirming — you can wait it out, or move now at a discipline-score cost.
              </Text>
            </View>
          </View>
        )}

        {frequentMoveCount > 2 && (
          <View style={[styles.noteCard, styles.warnCard]}>
            <AlertTriangle size={16} color={colors.clay} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noteTitle}>You've moved money from this pocket {frequentMoveCount} times recently</Text>
              <Text style={styles.noteBody}>
                Consider whether {fromPocket.name}'s monthly allocation needs adjusting instead.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.reviewList}>
          <ReviewRow label="From" value={fromPocket.name} />
          <ReviewRow label="To" value={toPocket.name} />
          <ReviewRow label="Amount" value={formatCurrency(amount)} />
          <ReviewRow label="Reason" value={REASONS.find((r) => r.value === reason)?.label || 'Other'} />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Button fullWidth size="lg" onPress={handleConfirm} loading={isSubmitting}>
            Confirm
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewKey}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.ink,
    marginTop: spacing.md,
  },
  subtext: {
    ...typography.body,
    color: colors.sage,
    marginTop: spacing.md,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  flowPocket: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: borderWidth,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  flowPocketTo: {
    borderWidth: borderWidthThick,
    borderColor: colors.emeraldDeep,
    backgroundColor: colors.emeraldTint,
  },
  flowName: {
    ...typography.heading,
    color: colors.ink,
  },
  flowAmt: {
    ...typography.body,
    color: colors.sage,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  moveLabel: {
    ...typography.caption,
    color: colors.sage,
  },
  moveValue: {
    ...typography.display,
    color: colors.emeraldDeep,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: borderWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderWidth: borderWidthThick,
    borderColor: colors.emeraldDeep,
    backgroundColor: colors.emeraldTint,
  },
  chipText: {
    ...typography.caption,
    color: colors.ink,
  },
  chipTextSelected: {
    color: colors.emeraldDeep,
  },
  noteCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.plumTint,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  warnCard: {
    backgroundColor: colors.clayTint,
  },
  noteTitle: {
    ...typography.heading,
    color: colors.ink,
  },
  noteBody: {
    ...typography.caption,
    color: colors.inkSoft,
    marginTop: 2,
  },
  reviewList: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: borderWidth,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewKey: {
    ...typography.caption,
    color: colors.sage,
  },
  reviewValue: {
    ...typography.body,
    color: colors.ink,
  },
});