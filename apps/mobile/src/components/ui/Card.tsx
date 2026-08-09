import React from 'react';
import { View, ViewStyle, Pressable } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, shadow } from '@/theme';

export interface CardProps extends Omit<React.ComponentPropsWithoutRef<typeof View>, 'children'> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  interactive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({ 
  children, 
  variant = 'default', 
  interactive = false, 
  onPress,
  style,
  ...props 
}: CardProps) {
  const { colors } = useTheme();
  
  const baseStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  };

  const variantStyles: Record<string, ViewStyle> = {
    default: {
      borderWidth: 1,
      borderColor: colors.line,
      ...shadow.default,
    },
    elevated: {
      borderWidth: 1,
      borderColor: colors.line,
      ...shadow.elevated,
    },
    outlined: {
      borderWidth: 2,
      borderColor: colors.line,
    },
  };

  const Component = onPress ? Pressable : View;

  return (
    <Component
      style={[
        baseStyle,
        variantStyles[variant],
        interactive && { borderColor: colors.emeraldDeep },
        style,
      ]}
      onPress={onPress}
      disabled={!onPress}
      {...props}
    >
      {children}
    </Component>
  );
}