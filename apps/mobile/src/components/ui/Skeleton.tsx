import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius } from '@/theme';

/**
 * Skeleton loading component for showing placeholder content.
 * Used when data is loading to improve perceived performance.
 */
export function Skeleton({ width, height, style }: { width?: number | string; height?: number | string; style?: any }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          width: width || '100%',
          height: height || 20,
          borderRadius: radius.sm,
          backgroundColor: colors.lineSoft,
        },
        style,
      ]}
    />
  );
}

/**
 * Card skeleton with title and content lines.
 */
export function CardSkeleton() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        marginBottom: spacing.md,
      }}
    >
      <Skeleton width="60%" height={20} style={{ marginBottom: spacing.sm }} />
      <Skeleton width="100%" height={16} style={{ marginBottom: spacing.xs }} />
      <Skeleton width="80%" height={16} />
    </View>
  );
}

/**
 * List item skeleton with icon and text.
 */
export function ListItemSkeleton() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: radius.xs, backgroundColor: colors.lineSoft, marginRight: spacing.md }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="70%" height={16} style={{ marginBottom: spacing.xs }} />
        <Skeleton width="50%" height={14} />
      </View>
    </View>
  );
}

/**
 * Pocket card skeleton with icon, name, and amount.
 */
export function PocketSkeleton() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.lineSoft, marginRight: spacing.md }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="60%" height={18} style={{ marginBottom: spacing.xs }} />
        <Skeleton width="40%" height={14} />
      </View>
      <Skeleton width={80} height={24} />
    </View>
  );
}
