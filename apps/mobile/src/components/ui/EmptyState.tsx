import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography } from '@/theme';
import { EmptyIllustration, EmptyIllustrationVariant } from './EmptyIllustration';

interface EmptyStateProps {
  /** Which scene to draw — defaults to 'empty' (a turned-out pocket). */
  variant?: EmptyIllustrationVariant;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Reusable empty state component with consistent styling.
 * Used when lists are empty or no data is available. Draws one of the
 * three EmptyIllustration scenes (pocket-and-stitch motif) instead of a
 * generic Lucide icon in a tinted circle.
 */
export function EmptyState({ variant = 'empty', title, description, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.md }}>
      <EmptyIllustration variant={variant} color={colors.sage} accentColor={colors.gold} />
      <Text style={{ ...typography.heading, color: colors.ink, textAlign: 'center' }}>{title}</Text>
      <Text style={{ ...typography.body, color: colors.sage, textAlign: 'center', marginTop: spacing.xs }}>{description}</Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginTop: spacing.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.pill,
            backgroundColor: colors.emeraldDeep,
          }}
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
        >
          <Plus size={16} color={colors.surface} strokeWidth={2} />
          <Text style={{ ...typography.heading, color: colors.surface }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Empty state for no search results.
 */
export function NoResultsEmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      variant="no-results"
      title="No results found"
      description="Try adjusting your search terms or filters"
      actionLabel={onClear ? "Clear search" : undefined}
      onAction={onClear}
    />
  );
}

/**
 * Empty state for no items in a list.
 */
export function NoItemsEmptyState({ actionLabel, onAction }: { actionLabel?: string; onAction?: () => void }) {
  return (
    <EmptyState
      variant="empty"
      title="No items yet"
      description="Get started by adding your first item"
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}

/**
 * Empty state for error/failure state.
 */
export function ErrorEmptyState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      variant="error"
      title="Something went wrong"
      description={message || "Failed to load data. Please try again."}
      actionLabel={onRetry ? "Try again" : undefined}
      onAction={onRetry}
    />
  );
}