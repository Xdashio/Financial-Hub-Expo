import React from 'react';
import { Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing } from '@/theme';
import { safeGoBack } from '@/utils/navigation';

interface BackButtonProps {
  onPress?: () => void;
  /** Used when there is no navigation history (web refresh / deep link). */
  fallbackHref?: Href;
  accessibilityLabel?: string;
}

/**
 * Reusable back button component with consistent styling.
 * Standardizes back navigation across all screens.
 */
export function BackButton({
  onPress,
  fallbackHref = '/(tabs)',
  accessibilityLabel = 'Go back',
}: BackButtonProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    safeGoBack(router, fallbackHref);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={{ padding: spacing.sm }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
    </Pressable>
  );
}
