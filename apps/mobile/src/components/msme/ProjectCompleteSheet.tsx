/* eslint-disable react-hooks/set-state-in-effect -- F-04 reset on open: parent should use key before GA */
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check, PiggyBank, Pause } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography, borderWidth } from '@/theme';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { formatMoney } from '@/utils/money';
import { msmeProjectsApi } from '@/services/api';

type TierBrief = { tier: 'priorities' | 'needs' | 'wants'; remainingCash: number; targetAmount: number; allocatedAmount: number };

interface CompleteInfo {
  project: any;
  remainingPerTier: TierBrief[];
  totalRemaining: number;
  suggestion: string;
  requiresResolution: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  project: any; // ProjectSummary
  completeInfo: CompleteInfo | null;
  onSuccess: () => void;
}

export function ProjectCompleteSheet({ visible, onClose, projectId, project, completeInfo, onSuccess }: Props) {
  const { colors } = useTheme();
  const [target, setTarget] = useState<'savings' | 'keep' | null>(null);
  const [confirmSavings, setConfirmSavings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTarget(null);
      setConfirmSavings(false);
      setError(null);
      setSaving(false);
    }
  }, [visible]);

  const totalRemaining = completeInfo?.totalRemaining ?? project?.totalRemaining ?? 0;
  const fmt = formatMoney(totalRemaining);
  const hasRemaining = totalRemaining > 0;
  const alreadyResolved = project?.completionResolvedTo != null;

  const handleChoose = (t: 'savings' | 'keep') => {
    setTarget(t);
    if (t !== 'savings') setConfirmSavings(false);
    setError(null);
  };

  const handleResolve = async () => {
    if (!target) return;
    if (target === 'savings' && !confirmSavings) {
      setConfirmSavings(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await msmeProjectsApi.resolveCompletion(projectId, { target, confirmSavings: target === 'savings' ? true : undefined });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resolve completion.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Project completed" headerGlyph={<Check size={16} color={colors.plum} />}>
      <View style={{ backgroundColor: colors.goldTint, borderWidth, borderColor: colors.gold + '30', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ width: 36, height: 36, borderRadius: radius.xs, backgroundColor: colors.plumTint, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={16} color={colors.plum} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.heading, color: colors.plum }}>{project?.name ?? 'Project'} completed</Text>
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2, lineHeight: 16 }}>
            {hasRemaining
              ? `${fmt} remains across tiers — the system will not silently move it (§22:549). Choose Keep or Move to Savings.`
              : 'No remaining funds — nothing to move. You can keep this record as completed.'}
          </Text>
        </View>
      </View>

      {completeInfo && hasRemaining && (
        <View style={{ backgroundColor: colors.surface, borderWidth, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Remaining per tier</Text>
          {completeInfo.remainingPerTier.map((r) => (
            <View key={r.tier} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ ...typography.caption, color: colors.sage, textTransform: 'capitalize' }}>{r.tier}</Text>
              <Text style={{ ...typography.caption, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatMoney(r.remainingCash)} left (of {formatMoney(r.allocatedAmount)} alloc)</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: colors.lineSoft, marginVertical: spacing.sm }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ ...typography.heading, color: colors.ink }}>Total unused</Text>
            <Text style={{ ...typography.heading, color: colors.plum, fontVariant: ['tabular-nums'] }}>{fmt}</Text>
          </View>
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, lineHeight: 16 }}>{completeInfo.suggestion}</Text>
        </View>
      )}

      {alreadyResolved && (
        <View style={{ backgroundColor: colors.emeraldTint, borderWidth, borderColor: colors.emeraldDeep + '30', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
          <Check size={14} color={colors.emeraldDeep} />
          <Text style={{ ...typography.caption, color: colors.emeraldDeep, flex: 1 }}>
            Already resolved to <Text style={{ ...typography.heading, color: colors.emeraldDeep }}>{project?.completionResolvedTo}</Text> at {project?.completionResolvedAt ? new Date(project.completionResolvedAt).toLocaleString('en-KE') : ''}.
          </Text>
        </View>
      )}

      {!alreadyResolved && hasRemaining && (
        <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          {([
            { id: 'savings', label: 'Move to Savings', sub: `Move ${fmt} to MSME Savings pocket`, icon: PiggyBank, color: colors.emeraldDeep, bg: colors.emeraldTint },
            { id: 'keep', label: 'Keep in project', sub: 'Leave funds in project tiers', icon: Pause, color: colors.sage, bg: colors.lineSoft },
          ] as const).map((opt) => {
            const isSelected = target === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => handleChoose(opt.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${opt.label}: ${opt.sub}${isSelected ? ' selected' : ''}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth,
                  borderColor: isSelected ? opt.color : colors.line,
                  backgroundColor: isSelected ? opt.bg : colors.surface,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: radius.xs, backgroundColor: isSelected ? opt.color + '18' : colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <opt.icon size={16} color={isSelected ? opt.color : colors.sage} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.heading, color: isSelected ? opt.color : colors.ink }}>{opt.label}</Text>
                  <Text style={{ ...typography.caption, color: colors.sage }}>{opt.sub}</Text>
                </View>
                {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: opt.color }} />}
              </Pressable>
            );
          })}
        </View>
      )}

      {!alreadyResolved && hasRemaining && target === 'savings' && !confirmSavings && (
        <View style={{ backgroundColor: colors.plumTint, borderWidth, borderColor: colors.plum + '30', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ ...typography.caption, color: colors.plum, lineHeight: 18 }}>
            You chose Savings. This moves <Text style={{ ...typography.heading, color: colors.plum }}>{fmt}</Text> to your MSME Savings pocket. Tap again to confirm — explicit confirmation is required per §22.
          </Text>
        </View>
      )}

      {!!error && (
        <View style={{ backgroundColor: colors.clayTint, borderWidth, borderColor: colors.clay + '30', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ ...typography.caption, color: colors.clay }}>{error}</Text>
        </View>
      )}

      {!alreadyResolved && hasRemaining ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button variant="secondary" style={{ flex: 1 }} onPress={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button style={{ flex: 1 }} onPress={handleResolve} disabled={!target || saving} loading={saving}>
            {!target ? 'Choose an option' : target === 'savings' && !confirmSavings ? 'Confirm move to Savings' : target === 'savings' ? 'Move to Savings' : 'Keep in project'}
          </Button>
        </View>
      ) : !alreadyResolved && !hasRemaining ? (
        <Button fullWidth onPress={onClose}>
          Done
        </Button>
      ) : (
        <Button fullWidth variant="secondary" onPress={onClose}>
          Close
        </Button>
      )}

      <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.md, textAlign: 'center', lineHeight: 15 }}>
        Per §22:534 the system must not silently transfer or remove remaining funds — this action is always explicit.
      </Text>
    </BottomSheetModal>
  );
}
