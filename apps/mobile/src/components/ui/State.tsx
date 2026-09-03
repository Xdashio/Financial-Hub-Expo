import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, touchTarget } from '@/theme';
import {
  CardSkeleton,
  ListItemSkeleton,
  PocketSkeleton,
  HomeSkeleton,
  MsmeHomeSkeleton,
  PocketDetailSkeleton,
  ProjectDetailSkeleton,
  LoansSkeleton,
  ProjectsSkeleton,
  InvoicesSkeleton,
  InvoiceDetailSkeleton,
  StockSkeleton,
  StockDetailSkeleton,
  InsightsSkeleton,
} from './Skeleton';
import { PocketLoader } from './PocketLoader';
import { EmptyIllustration } from './EmptyIllustration';

/**
 * Full-bleed loading state, used in place of the many one-off
 * `<ActivityIndicator>` blocks that were scattered across screens with
 * slightly different sizing, color, and copy. Using this everywhere keeps
 * every "screen is loading" moment in the app looking and feeling the same.
 */
export function LoadingState({
  label,
  variant = 'spinner',
}: {
  label?: string;
  variant?:
    | 'spinner'
    | 'cards'
    | 'list'
    | 'pockets'
    | 'home'
    | 'msme-home'
    | 'pocket-detail'
    | 'project-detail'
    | 'loans'
    | 'projects'
    | 'invoices'
    | 'invoice-detail'
    | 'stock'
    | 'stock-detail'
    | 'insights';
}) {
  const { colors } = useTheme();

  if (variant === 'spinner') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <PocketLoader size={40} color={colors.emeraldDeep} />
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

  if (variant === 'home') {
    return (
      <View style={{ flex: 1 }}>
        <HomeSkeleton />
      </View>
    );
  }

  if (variant === 'msme-home') {
    return (
      <View style={{ flex: 1 }}>
        <MsmeHomeSkeleton />
      </View>
    );
  }

  if (variant === 'pocket-detail') {
    return (
      <View style={{ flex: 1 }}>
        <PocketDetailSkeleton />
      </View>
    );
  }

  if (variant === 'project-detail') {
    return (
      <View style={{ flex: 1 }}>
        <ProjectDetailSkeleton />
      </View>
    );
  }

  if (variant === 'loans') {
    return (
      <View style={{ flex: 1 }}>
        <LoansSkeleton />
      </View>
    );
  }

  if (variant === 'projects') {
    return (
      <View style={{ flex: 1 }}>
        <ProjectsSkeleton />
      </View>
    );
  }

  if (variant === 'invoices') {
    return (
      <View style={{ flex: 1 }}>
        <InvoicesSkeleton />
      </View>
    );
  }

  if (variant === 'stock') {
    return (
      <View style={{ flex: 1 }}>
        <StockSkeleton />
      </View>
    );
  }

  if (variant === 'invoice-detail') {
    return (
      <View style={{ flex: 1 }}>
        <InvoiceDetailSkeleton />
      </View>
    );
  }

  if (variant === 'stock-detail') {
    return (
      <View style={{ flex: 1 }}>
        <StockDetailSkeleton />
      </View>
    );
  }

  if (variant === 'insights') {
    return (
      <View style={{ flex: 1 }}>
        <InsightsSkeleton />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
      <PocketLoader size={40} color={colors.emeraldDeep} />
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
      {/* Dropped-stitch pocket scene — same family as EmptyState, so a
          failure reads as "this app's stitch came loose" rather than a
          generic AlertCircle-in-a-tinted-square. */}
      <EmptyIllustration variant="error" size={64} color={colors.sage} accentColor={colors.clay} />
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
      <PocketLoader size={22} color={colors.emeraldDeep} />
    </View>
  );
}