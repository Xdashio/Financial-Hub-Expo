import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing } from '@/theme';

export interface DividerProps {
  variant?: 'horizontal' | 'vertical';
  thickness?: 'thin' | 'medium' | 'thick';
  style?: ViewStyle;
}

export function Divider({ 
  variant = 'horizontal', 
  thickness = 'thin',
  style,
}: DividerProps) {
  const { colors } = useTheme();
  
  const baseStyle: ViewStyle = {
    backgroundColor: colors.line,
  };

  const thicknessStyles: Record<string, ViewStyle> = {
    thin: variant === 'horizontal' ? { height: 1 } : { width: 1 },
    medium: variant === 'horizontal' ? { height: 2 } : { width: 2 },
    thick: variant === 'horizontal' ? { height: 3 } : { width: 3 },
  };

  const dimensionStyles: ViewStyle = variant === 'horizontal' 
    ? { width: '100%', marginVertical: spacing.md }
    : { height: '100%', marginHorizontal: spacing.md };

  return (
    <View style={[baseStyle, thicknessStyles[thickness], dimensionStyles, style]} />
  );
}