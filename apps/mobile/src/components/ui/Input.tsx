import React from 'react';
import { View, Text, TextInput, ViewStyle, TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, touchTarget, borderWidth } from '@/theme';

export interface InputProps extends Omit<React.ComponentPropsWithoutRef<typeof TextInput>, 'style' | 'autoComplete'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
  autoComplete?: TextInputProps['autoComplete'];
  gap?: number;
}

export function Input({
  label,
  error,
  helperText,
  leftElement,
  rightElement,
  style,
  gap = spacing.md,
  ...props
}: InputProps) {
  const { colors } = useTheme();

  return (
    <View style={{ gap, ...style }}>
      {!!label && (
        <Text style={{ ...typography.caption, color: colors.ink, letterSpacing: 0.36 }}>
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderWidth: borderWidth,
          borderColor: error ? colors.error : colors.line,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          minHeight: touchTarget.minHeight,
        }}
      >
        {leftElement}
        <TextInput
          placeholderTextColor={colors.sage}
          style={{
            flex: 1,
            ...typography.body,
            color: colors.ink,
            paddingVertical: spacing.sm,
            outlineStyle: 'none',
            outlineWidth: 0,
          } as any}
          {...props}
        />
        {rightElement}
      </View>
      {error ? <Text style={{ ...typography.caption, color: colors.error }}>{error}</Text> : null}
      {helperText && !error ? <Text style={{ ...typography.caption, color: colors.sage }}>{helperText}</Text> : null}
    </View>
  );
}