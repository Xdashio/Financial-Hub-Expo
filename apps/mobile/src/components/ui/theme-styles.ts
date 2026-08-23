import { useTheme } from '@/theme/ThemeContext';
import { ViewStyle, TextStyle } from 'react-native';
import { radius, spacing, shadow, touchTarget, borderWidth, borderWidthThick } from '@/theme';

/**
 * Theme-aware style factory - creates styles that respond to theme changes
 * 
 * Usage:
 *   const styles = useMakeStyles((colors) => ({
 *     container: { backgroundColor: colors.surface },
 *     text: { color: colors.ink },
 *   }));
 */
export function useMakeStyles<T extends Record<string, ViewStyle | TextStyle>>(
  styleFactory: (colors: any) => T
): T {
  const { colors } = useTheme();
  return styleFactory(colors);
}

/**
 * Common style patterns that should be used throughout the app
 * These are pre-defined to ensure consistency
 */
export const commonStyles = {
  // Layout
  container: (colors: any): ViewStyle => ({
    flex: 1,
    backgroundColor: colors.paper,
  }),
  
  safeArea: (colors: any): ViewStyle => ({
    flex: 1,
    backgroundColor: colors.surface,
  }),
  
  // Cards
  card: (colors: any): ViewStyle => ({
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow.default,
  }),
  
  cardInteractive: (colors: any): ViewStyle => ({
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidthThick,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow.default,
  }),
  
  // Inputs
  input: (colors: any, hasError = false): ViewStyle => ({
    backgroundColor: colors.surface,
    borderWidth: borderWidth,
    borderColor: hasError ? colors.error : colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTarget.minHeight,
  }),
  
  // Buttons
  button: (_colors: any): ViewStyle => ({
    borderRadius: radius.button,
    borderWidth: borderWidthThick,
    minHeight: touchTarget.minHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  }),
  
  buttonPrimary: (colors: any): ViewStyle => ({
    backgroundColor: colors.emeraldDeep,
    borderColor: colors.emeraldDeep,
  }),
  
  buttonSecondary: (colors: any): ViewStyle => ({
    backgroundColor: colors.surface,
    borderColor: colors.line,
  }),
  
  // Spacing
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  
  gap: {
    gap: spacing.md,
  },
  
  gapSm: {
    gap: spacing.sm,
  },
  
  gapLg: {
    gap: spacing.lg,
  },
  
  // Text
  heading: (colors: any): TextStyle => ({
    color: colors.ink,
  }),
  
  body: (colors: any): TextStyle => ({
    color: colors.ink,
  }),
  
  caption: (colors: any): TextStyle => ({
    color: colors.sage,
  }),
  
  // Semantic colors
  success: (colors: any): ViewStyle => ({
    backgroundColor: colors.successTint,
    borderColor: colors.success,
  }),
  
  warning: (colors: any): ViewStyle => ({
    backgroundColor: colors.warningTint,
    borderColor: colors.warning,
  }),
  
  error: (colors: any): ViewStyle => ({
    backgroundColor: colors.errorTint,
    borderColor: colors.error,
  }),
  
  info: (colors: any): ViewStyle => ({
    backgroundColor: colors.infoTint,
    borderColor: colors.info,
  }),
};

/**
 * Helper to create theme-aware styles inline
 * 
 * Usage:
 *   <View style={useCreateThemedStyle((colors) => ({ backgroundColor: colors.surface, padding: spacing.md }))} />
 */
export const useCreateThemedStyle = (
  styleFn: (colors: any) => ViewStyle | TextStyle
) => {
  const { colors } = useTheme();
  return styleFn(colors);
};

/**
 * Helper to check if current theme is dark
 */
export const useIsDark = () => {
  const { scheme } = useTheme();
  return scheme === 'dark';
};

/**
 * Helper to get appropriate color for semantic intent
 */
export const useSemanticColor = () => {
  const { colors } = useTheme();
  
  return {
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    successTint: colors.successTint,
    warningTint: colors.warningTint,
    errorTint: colors.errorTint,
    infoTint: colors.infoTint,
  };
};