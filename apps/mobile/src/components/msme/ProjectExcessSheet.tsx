import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { AlertTriangle, ArrowRight, PiggyBank, Package, Star, Pause } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography, borderWidth } from '@/theme';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { formatMoney } from '@/utils/money';
import { msmeProjectsApi } from '@/services/api';

type ExcessPrompt = {
  id: string;
  project_id: string;
  income_event_id: string;
  excess_amount: number;
  status: string;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  prompt: ExcessPrompt | null;
  onSuccess: () => void;
}

type Target = 'needs' | 'wants' | 'savings' | 'keep';

export function ProjectExcessSheet({ visible, onClose, projectId, projectName, prompt, onSuccess }: Props) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<Target | null>(null);
  const [confirmSavings, setConfirmSavings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // reset when sheet opens/closes or prompt changes
  React.useEffect(() => {
    if (visible) {
      setSelected(null);
      setConfirmSavings(false);
      setError(null);
      setSaving(false);
    }
  }, [visible, prompt?.id]);

  if (!prompt) return null;

  const excess = Number(prompt.excess_amount);
  const fmt = formatMoney(excess);

  const handleChoose = (target: Target) => {
    setError(null);
    setSelected(target);
    if (target !== 'savings') setConfirmSavings(false);
  };

  const handleResolve = async () => {
    if (!selected) return;
    // Savings requires second tap
    if (selected === 'savings' && !confirmSavings) {
      setConfirmSavings(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await msmeProjectsApi.resolveExcessPrompt(projectId, prompt.id, selected, selected === 'savings' ? true : undefined);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resolve excess. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = async () => {
    setSaving(true);
    try {
      await msmeProjectsApi.dismissExcessPrompt(projectId, prompt.id);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not dismiss. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isSavings = selected === 'savings';
  const primaryLabel = !selected
    ? 'Choose a target'
    : isSavings && !confirmSavings
      ? 'Confirm move to Savings'
      : isSavings && confirmSavings
        ? 'Move to Savings'
        : selected === 'needs'
          ? 'Allocate to Needs'
          : selected === 'wants'
            ? 'Allocate to Wants'
            : 'Keep as surplus';

  const primaryDisabled = !selected || saving;

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Excess funds" headerGlyph={<Package size={16} color={colors.emeraldDeep} />}>
      <Text style={{ ...typography.body, color: colors.sage, lineHeight: 20, marginBottom: spacing.lg }}>
        <Text style={{ ...typography.heading, color: colors.ink }}>{projectName}</Text> received <Text style={{ ...typography.heading, color: colors.gold }}>{fmt}</Text> more than its planned funding targets. Per §21, excess is never moved silently — choose where it should go.
      </Text>

      <View style={{ backgroundColor: colors.goldTint, borderWidth, borderColor: colors.gold + '30', borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        <AlertTriangle size={16} color={colors.gold} strokeWidth={2} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.heading, color: colors.gold }}>{fmt} excess pending</Text>
          <Text style={{ ...typography.caption, color: colors.gold + 'CC', marginTop: 2, lineHeight: 16 }}>
            All tiers are already fully funded. Directing excess to Needs/Wants will overfund that tier; Savings moves it to your MSME Savings pocket (requires a second confirmation per §21:526); Keep leaves it as project surplus until completion.
          </Text>
        </View>
      </View>

      <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
        {([
          { id: 'needs', label: 'Needs', sub: 'Add to Needs tier', icon: Package, color: colors.emeraldDeep, bg: colors.emeraldTint },
          { id: 'wants', label: 'Wants', sub: 'Add to Wants tier', icon: Star, color: colors.gold, bg: colors.goldTint },
          { id: 'savings', label: 'Savings', sub: 'Move to MSME Savings pocket', icon: PiggyBank, color: colors.plum, bg: colors.plumTint },
          { id: 'keep', label: 'Keep', sub: 'Leave as project surplus', icon: Pause, color: colors.sage, bg: colors.lineSoft },
        ] as const).map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => handleChoose(opt.id)}
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

      {isSavings && !confirmSavings && selected === 'savings' && (
        <View style={{ backgroundColor: colors.plumTint, borderWidth, borderColor: colors.plum + '30', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
          <Text style={{ ...typography.caption, color: colors.plum, lineHeight: 18 }}>
            You chose Savings. This moves <Text style={{ ...typography.heading, color: colors.plum }}>{fmt}</Text> out of the project into your MSME Savings pocket. Tap again to confirm — this requires explicit confirmation per §21:526.
          </Text>
        </View>
      )}

      {!!error && (
        <View style={{ backgroundColor: colors.clayTint, borderWidth, borderColor: colors.clay + '30', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
          <Text style={{ ...typography.caption, color: colors.clay, lineHeight: 18 }}>{error}</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button variant="secondary" style={{ flex: 1 }} onPress={handleDismiss} disabled={saving}>
          Dismiss
        </Button>
        <Button style={{ flex: 1 }} onPress={handleResolve} disabled={primaryDisabled} loading={saving} rightIcon={!saving ? <ArrowRight size={14} color={colors.surface} /> : undefined}>
          {primaryLabel}
        </Button>
      </View>

      <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.md, lineHeight: 15, textAlign: 'center' }}>
        Need/Wants are single-tap; Savings needs a second explicit tap. This keeps the system’s default bias toward finishing the project’s own plan before diverting cash elsewhere (ADR-001 Gap 3).
      </Text>
    </BottomSheetModal>
  );
}
