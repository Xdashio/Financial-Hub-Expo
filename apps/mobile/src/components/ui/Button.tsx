import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, touchTarget, borderWidthThick } from '@/theme';

export interface ButtonProps extends Omit<React.ComponentPropsWithoutRef<typeof TouchableOpacity>, 'children' | 'style'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();

  // Buttons are tappable, high-intent surfaces — they get the crisper
  // 1.5px border treatment from the mockups, not the softer hairline used
  // for passive containers like Card. `radius.button` is the single radius
  // token every Button variant/size uses, so buttons stay visually
  // consistent everywhere they appear.
  const baseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.button,
    borderWidth: borderWidthThick,
    minHeight: touchTarget.minHeight,
  };

  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      backgroundColor: colors.emeraldDeep,
      borderColor: colors.emeraldDeep,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderColor: colors.line,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.emeraldDeep,
    },
  };

  const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    md: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    lg: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  };

  const textStyles: Record<string, TextStyle> = {
    primary: { color: colors.surface },
    secondary: { color: colors.ink },
    ghost: { color: colors.emeraldDeep },
    outline: { color: colors.emeraldDeep },
  };

  return (
    <TouchableOpacity
      style={[
        baseStyle,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && { width: '100%' },
        { opacity: loading || disabled ? 0.6 : 1 },
        style,
      ]}
      disabled={loading || disabled}
      activeOpacity={0.85}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'ghost' ? colors.surface : colors.emeraldDeep} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
          {leftIcon && <View style={{ flexShrink: 0 }}>{leftIcon}</View>}
          <Text style={[{ ...typography.body, ...textStyles[variant] }, loading && { opacity: 0 }]}>{children}</Text>
          {rightIcon && (
            <View style={{ flexShrink: 0, marginLeft: spacing.xs }}>
              {rightIcon}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}