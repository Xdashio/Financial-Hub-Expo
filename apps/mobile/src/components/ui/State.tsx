import React from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, radius, touchTarget } from '@/theme';
import { Skeleton, CardSkeleton, ListItemSkeleton, PocketSkeleton } from './Skeleton';

/**
 * Full-bleed loading state, used in place of the many one-off
 * `<ActivityIndicator>` blocks that were scattered across screens with
 * slightly different sizing, color, and copy. Using this everywhere keeps
 * every "screen is loading" moment in the app looking and feeling the same.
 */
export function LoadingState({ label, variant = 'spinner' }: { label?: string; variant?: 'spinner' | 'cards' | 'list' | 'pockets' }) {
  const { colors } = useTheme();

  if (variant === 'spinner') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <ActivityIndicator size="large" color={colors.emeraldDeep} />
        {!!label && (
          <Text style={{ ...typography.caption, color: colors.sage }}>{label}</Text>
        )}
      </View>
    );
  }

  if (variant === 'cards') {
    return (
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </View>
    );
  }

  if (variant === 'list') {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </View>
    );
  }

  if (variant === 'pockets') {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <PocketSkeleton />
        <PocketSkeleton />
        <PocketSkeleton />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
      <ActivityIndicator size="large" color={colors.emeraldDeep} />
      {!!label && (
        <Text style={{ ...typography.caption, color: colors.sage }}>{label}</Text>
      )}
    </View>
  );
}

/**
 * Full-bleed error state with a retry action. Several screens previously
 * failed silently (blank screen, no way to recover) when a request errored
 * after the loading spinner finished — this gives every screen the same
 * recoverable failure path.
 */
export function ErrorState({
  message = "Something went wrong. Please try again.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.md,
          backgroundColor: colors.clayTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AlertCircle size={22} color={colors.clay} strokeWidth={2} />
      </View>
      <Text style={{ ...typography.body, color: colors.sage, textAlign: 'center' }}>{message}</Text>
      {!!onRetry && (
        <Pressable
          onPress={onRetry}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginTop: spacing.xs,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            minHeight: touchTarget.minHeight,
            borderRadius: radius.pill,
            backgroundColor: colors.emeraldDeep,
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Try again"
          accessibilityRole="button"
        >
          <RefreshCw size={14} color={colors.surface} strokeWidth={2} />
          <Text style={{ ...typography.heading, color: colors.surface }}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Small inline animated loader for "load more" rows at the bottom of a list. */
export function InlineLoading() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
      <ActivityIndicator size="small" color={colors.emeraldDeep} />
    </View>
  );
}