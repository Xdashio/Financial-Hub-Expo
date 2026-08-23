import React from 'react';
import { View, Text } from 'react-native';
import { Bell, Sparkles } from 'lucide-react-native';
import { spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { NudgeCard } from './NudgeCard';
import type { Nudge } from '@/services/nudges';

interface NudgesSheetProps {
  visible: boolean;
  onClose: () => void;
  nudges: Nudge[];
}

export function NudgesSheet({ visible, onClose, nudges }: NudgesSheetProps) {
  const { colors } = useTheme();

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Nudges" headerIcon={Bell}>
      {nudges.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
          <Sparkles size={28} color={colors.sage} strokeWidth={2} />
          <Text style={{ ...typography.body, color: colors.ink, marginTop: spacing.md, textAlign: 'center' }}>
            You&apos;re all caught up
          </Text>
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, textAlign: 'center' }}>
            No nudges right now — check back after your next spend or income.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {nudges.map((nudge) => (
            <NudgeCard key={nudge.id} nudge={nudge} onNavigate={onClose} />
          ))}
        </View>
      )}
    </BottomSheetModal>
  );
}