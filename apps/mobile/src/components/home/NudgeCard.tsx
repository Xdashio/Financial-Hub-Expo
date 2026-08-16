import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ChevronRight } from 'lucide-react-native';
import type { Nudge, NudgeSeverity } from '@/services/nudges';

interface NudgeCardProps {
  nudge: Nudge;
  onNavigate?: () => void;
}

function useSeverityColors(severity: NudgeSeverity) {
  const { colors } = useTheme();
  switch (severity) {
    case 'alert':
      return { tint: colors.clayTint, fg: colors.clay };
    case 'caution':
      return { tint: colors.goldTint, fg: colors.gold };
    case 'positive':
      return { tint: colors.emeraldTint, fg: colors.emeraldDeep };
    case 'info':
    default:
      return { tint: colors.plumTint, fg: colors.plum };
  }
}

export function NudgeCard({ nudge, onNavigate }: NudgeCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { tint, fg } = useSeverityColors(nudge.severity);
  const Icon = nudge.icon;

  const content = (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        backgroundColor: colors.paper,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radius.sm,
        padding: spacing.md,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={fg} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.body, color: colors.ink }}>{nudge.title}</Text>
        <Text style={{ ...typography.caption, color: colors.sage, marginTop: 4, lineHeight: 17 }}>{nudge.message}</Text>
        {nudge.actionLabel && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: spacing.sm }}>
            <Text style={{ ...typography.caption, color: fg }}>{nudge.actionLabel}</Text>
            <ChevronRight size={14} color={fg} strokeWidth={2.5} />
          </View>
        )}
      </View>
    </View>
  );

  if (!nudge.route) return content;

  return (
    <Pressable
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
      onPress={() => {
        onNavigate?.();
        router.push(nudge.route as any);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${nudge.title}. ${nudge.message}`}
    >
      {content}
    </Pressable>
  );
}