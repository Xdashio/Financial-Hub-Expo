import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer } from '@/components/ui';
import { PlanningCycleScreen } from '@/components/pockets/PlanningCycleScreen';
import { safeGoBack } from '@/utils/navigation';

/**
 * Planning Cycle route (M6). The freelancer dashboard's "Planning Cycle"
 * quick-action card used to be a dead button — it now pushes here. The
 * screen itself is the shared PlanningCycleScreen component (status,
 * current-cycle allocations, trigger flow, history), wrapped with the
 * standard back header so it behaves like every other (pockets) route.
 */
export default function PlanningCycleRoute() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <ScreenContainer>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingTop: spacing.md,
        }}
      >
        <Pressable
          onPress={() => safeGoBack(router, '/(tabs)/freelancer-dashboard')}
          accessibilityRole="button"
          accessibilityLabel="Back to freelancer dashboard"
          hitSlop={12}
          style={{ padding: spacing.xs }}
        >
          <ArrowLeft size={22} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={{ ...typography.title, color: colors.ink }}>Planning Cycle</Text>
      </View>
      {/* PlanningCycleScreen owns its own ScrollView — do not wrap it in
          another scroller. */}
      <PlanningCycleScreen />
    </ScreenContainer>
  );
}
