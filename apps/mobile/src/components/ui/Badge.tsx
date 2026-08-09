import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography } from '@/theme';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'md',
  style,
}: BadgeProps) {
  const { colors } = useTheme();
  
  const baseStyle: ViewStyle = {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: size === 'sm' ? spacing.sm : spacing.md,
    paddingVertical: size === 'sm' ? spacing.xs : spacing.sm,
  };

  const variantStyles: Record<string, ViewStyle> = {
    default: {
      backgroundColor: colors.lineSoft,
    },
    success: {
      backgroundColor: colors.successTint,
    },
    warning: {
      backgroundColor: colors.warningTint,
    },
    error: {
      backgroundColor: colors.errorTint,
    },
    info: {
      backgroundColor: colors.infoTint,
    },
  };

  const textStyles: Record<string, TextStyle> = {
    default: { color: colors.sage },
    success: { color: colors.success },
    warning: { color: colors.warning },
    error: { color: colors.error },
    info: { color: colors.info },
  };

  return (
    <View style={[baseStyle, variantStyles[variant], style]}>
      <Text style={[typography.caption, textStyles[variant], { fontSize: size === 'sm' ? 10 : 12 }]}>
        {children}
      </Text>
    </View>
  );
}