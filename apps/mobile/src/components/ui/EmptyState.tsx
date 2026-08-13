import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Package, Plus, Search, AlertCircle, LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography } from '@/theme';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Reusable empty state component with consistent styling.
 * Used when lists are empty or no data is available.
 */
export function EmptyState({ icon: Icon = Package, title, description, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.md }}>
      <View style={{ width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={32} color={colors.sage} strokeWidth={2} />
      </View>
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
      icon={Search}
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
      icon={Package}
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
      icon={AlertCircle}
      title="Something went wrong"
      description={message || "Failed to load data. Please try again."}
      actionLabel={onRetry ? "Try again" : undefined}
      onAction={onRetry}
    />
  );
}
