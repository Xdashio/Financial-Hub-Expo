import React from 'react';
import { View, Text, ScrollView, Pressable, ViewStyle, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography } from '@/theme';
import { safeGoBack } from '@/utils/navigation';

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
        contentContainerStyle={[{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.sm }, contentContainerStyle]}
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

export function BrandHeader({
  onBack,
  fallbackHref = '/(tabs)',
}: {
  /**
   * Pass any function to show the back chevron. Navigation itself always
   * goes through safeGoBack so empty stacks (web refresh / deep link) don't
   * warn with GO_BACK. Use fallbackHref to control that destination.
   */
  onBack?: () => void;
  fallbackHref?: Href;
}) {
  const { colors } = useTheme();
  const router = useRouter();

  const handleBack = () => {
    safeGoBack(router, fallbackHref);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: onBack ? 'space-between' : 'center', paddingTop: onBack ? spacing.md : spacing.lg, marginBottom: spacing.md }}>
      {!!onBack && (
        <Pressable
          style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, { opacity: pressed ? 0.7 : 1 }]}
          onPress={handleBack}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ChevronLeft size={20} color={colors.ink} />
        </Pressable>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Image
          // This file lives one directory deeper than the old
          // src/components/ui.tsx (src/components/ui/Layout.tsx vs
          // src/components/ui.tsx), so the relative path needs an extra
          // `../` to still resolve to apps/mobile/assets/.
          source={require('../../../assets/icon.png')}
          style={{ width: 26, height: 26 }}
          resizeMode="contain"
        />
        <Text style={{ ...typography.heading, color: colors.ink, letterSpacing: -0.18 }}>
          Financial Hub
        </Text>
      </View>
      {!!onBack && <View style={{ width: 44 }} />}
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