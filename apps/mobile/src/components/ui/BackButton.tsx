import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing } from '@/theme';

interface BackButtonProps {
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Reusable back button component with consistent styling.
 * Standardizes back navigation across all screens.
 */
export function BackButton({ onPress, accessibilityLabel = "Go back" }: BackButtonProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (router.canGoBack()) {
      router.back();
    }
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
