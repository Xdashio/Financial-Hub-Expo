import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ViewStyle, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography } from '@/theme';

export function ScreenContainer({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }, style]}>
      {children}
    </View>
  );
}

export function SafeScrollView({ children, contentContainerStyle, ...props }: {
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle;
}) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        {...props}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function ProgressIndicator({ currentStep, totalSteps = 4 }: { currentStep: number; totalSteps?: number }) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: i < currentStep ? colors.emeraldDeep : colors.lineSoft,
          }}
        />
      ))}
    </View>
  );
}

export function BrandHeader({ onBack }: { onBack?: () => void }) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: onBack ? 'space-between' : 'center', paddingTop: onBack ? spacing.sm : spacing.lg }}>
      {!!onBack && (
        <TouchableOpacity
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={20} color={colors.ink} />
        </TouchableOpacity>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Image
          // This file lives one directory deeper than the old
          // src/components/ui.tsx (src/components/ui/Layout.tsx vs
          // src/components/ui.tsx), so the relative path needs an extra
          // `../` to still resolve to apps/mobile/assets/.
          source={require('../../../assets/financial_hub_logo_transparent.png')}
          style={{ width: 26, height: 26 }}
          resizeMode="contain"
        />
        <Text style={{ ...typography.heading, color: colors.ink, letterSpacing: -0.18 }}>
          Financial Hub
        </Text>
      </View>
      {!!onBack && <View style={{ width: 36 }} />}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();

  return (
    <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>
      {children}
    </Text>
  );
}