import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, shadow } from '@/theme';

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

/**
 * Home screen skeleton matching the exact layout.
 */
export function HomeSkeleton() {
  const { colors } = useTheme();

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 26, height: 26, borderRadius: radius.xs, backgroundColor: colors.lineSoft }} />
          <Skeleton width={120} height={20} />
        </View>
        <View style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.lineSoft }} />
      </View>

      {/* Safe to spend */}
      <View style={{ marginBottom: spacing.md }}>
        <Skeleton width={150} height={14} style={{ marginBottom: spacing.xs }} />
        <Skeleton width={200} height={40} />
        <Skeleton width="100%" height={12} style={{ marginTop: spacing.xs }} />
      </View>

      {/* Runway */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: spacing.sm, 
        backgroundColor: colors.surface, 
        borderWidth: 1, 
        borderColor: colors.line, 
        borderRadius: radius.sm, 
        paddingHorizontal: spacing.md, 
        paddingVertical: spacing.sm + 2,
        marginBottom: spacing.md 
      }}>
        <View style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.lineSoft }} />
        <View style={{ flex: 1 }}>
          <Skeleton width={120} height={16} style={{ marginBottom: 2 }} />
          <Skeleton width="80%" height={12} />
        </View>
      </View>

      {/* Total balance */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: spacing.md, 
        paddingTop: spacing.md, 
        borderTopWidth: 1, 
        borderTopColor: colors.lineSoft 
      }}>
        <Skeleton width={100} height={14} />
        <Skeleton width={80} height={16} />
      </View>

      {/* Protection message */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: spacing.sm, 
        backgroundColor: colors.emeraldTint, 
        borderRadius: radius.sm, 
        paddingHorizontal: spacing.md, 
        paddingVertical: spacing.sm,
        marginBottom: spacing.xl 
      }}>
        <View style={{ width: 14, height: 14, borderRadius: radius.xs, backgroundColor: colors.lineSoft }} />
        <Skeleton width="100%" height={14} />
      </View>

      {/* Quick actions */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1 }}>
            <View style={{ 
              paddingVertical: spacing.md, 
              backgroundColor: colors.surface, 
              borderWidth: 1, 
              borderColor: colors.line, 
              borderRadius: radius.sm, 
              alignItems: 'center',
              marginBottom: spacing.xs 
            }}>
              <View style={{ width: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.lineSoft, marginBottom: spacing.sm }} />
              <Skeleton width={60} height={14} />
            </View>
          </View>
        ))}
      </View>

      {/* Pocket sections */}
      <View style={{ marginBottom: spacing.xl }}>
        <Skeleton width={140} height={16} style={{ marginBottom: spacing.md }} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ 
            backgroundColor: colors.surface, 
            borderWidth: 1, 
            borderColor: colors.line, 
            borderRadius: radius.sm, 
            padding: spacing.lg, 
            marginBottom: spacing.md,
            ...shadow.default 
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
              <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.lineSoft }} />
              <View style={{ flex: 1 }}>
                <Skeleton width="60%" height={18} style={{ marginBottom: 2 }} />
                <Skeleton width="40%" height={12} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Skeleton width={60} height={18} />
                <Skeleton width={50} height={12} style={{ marginTop: 2 }} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Pocket detail skeleton matching the exact layout.
 */
export function PocketDetailSkeleton() {
  const { colors } = useTheme();

  return (
    <View>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: spacing.lg, 
        paddingTop: spacing.md, 
        paddingBottom: spacing.sm 
      }}>
        <View style={{ width: 24, height: 24, borderRadius: radius.xs, backgroundColor: colors.lineSoft, marginRight: spacing.sm }} />
        <Skeleton width={150} height={24} />
      </View>

      {/* Hero card */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
        <View style={{ 
          backgroundColor: colors.heroBg, 
          borderRadius: radius.sm, 
          padding: spacing.lg, 
          paddingTop: spacing.xl,
          ...shadow.elevated 
        }}>
          <View style={{ height: 2, backgroundColor: colors.lineSoft, marginBottom: spacing.md }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.lineSoft }} />
            <View style={{ flex: 1 }}>
              <Skeleton width="60%" height={20} style={{ marginBottom: 4 }} />
              <Skeleton width="40%" height={14} />
            </View>
          </View>
          <Skeleton width={120} height={36} style={{ marginBottom: spacing.xs }} />
          <Skeleton width="80%" height={14} />
        </View>
      </View>

      {/* Stats */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1, padding: spacing.md, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.lineSoft }}>
              <Skeleton width={80} height={12} style={{ marginBottom: 4 }} />
              <Skeleton width={60} height={20} />
            </View>
          ))}
        </View>
      </View>

      {/* Sub-pockets */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <Skeleton width={140} height={16} style={{ marginBottom: spacing.md }} />
        {[1, 2].map((i) => (
          <View key={i} style={{ 
            backgroundColor: colors.surface, 
            borderWidth: 1, 
            borderColor: colors.line, 
            borderRadius: radius.sm, 
            padding: spacing.lg, 
            marginBottom: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md 
          }}>
            <View style={{ width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.lineSoft }} />
            <View style={{ flex: 1 }}>
              <Skeleton width="60%" height={16} style={{ marginBottom: 2 }} />
              <Skeleton width="40%" height={12} />
            </View>
            <Skeleton width={60} height={16} />
          </View>
        ))}
      </View>

      {/* Transaction history */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <Skeleton width={160} height={16} style={{ marginBottom: spacing.md }} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ 
            backgroundColor: colors.surface, 
            borderWidth: 1, 
            borderColor: colors.line, 
            borderRadius: radius.sm, 
            padding: spacing.md, 
            marginBottom: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md 
          }}>
            <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.lineSoft }} />
            <View style={{ flex: 1 }}>
              <Skeleton width="70%" height={16} style={{ marginBottom: 2 }} />
              <Skeleton width="50%" height={12} />
            </View>
            <Skeleton width={50} height={16} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Loans list skeleton matching the exact layout.
 */
export function LoansSkeleton() {
  const { colors } = useTheme();

  return (
    <View>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 24, height: 24, borderRadius: radius.xs, backgroundColor: colors.lineSoft, marginRight: spacing.sm }} />
          <Skeleton width={60} height={24} />
        </View>
        <Skeleton width={200} height={14} style={{ marginTop: spacing.xs }} />
      </View>

      {/* Create button */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
        <View style={{ 
          height: 44, 
          borderRadius: radius.sm, 
          backgroundColor: colors.lineSoft 
        }} />
      </View>

      {/* Loan cards */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ 
            backgroundColor: colors.surface, 
            borderWidth: 1, 
            borderColor: colors.line, 
            borderRadius: radius.sm, 
            padding: spacing.lg, 
            marginBottom: spacing.md,
            ...shadow.default 
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.lineSoft }} />
                <View>
                  <Skeleton width={120} height={18} style={{ marginBottom: 2 }} />
                  <Skeleton width={80} height={12} />
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Skeleton width={60} height={18} />
                <Skeleton width={50} height={12} style={{ marginTop: 2 }} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {[1, 2, 3].map((j) => (
                <View key={j} style={{ flex: 1 }}>
                  <Skeleton width={60} height={12} style={{ marginBottom: 2 }} />
                  <Skeleton width={40} height={14} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Insights screen skeleton matching the exact layout.
 */
export function InsightsSkeleton() {
  const { colors } = useTheme();

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      {/* Title */}
      <Skeleton width={100} height={32} style={{ marginTop: spacing.sm }} />

      {/* Discipline score hero */}
      <View style={{ 
        marginTop: spacing.xl, 
        borderRadius: radius.lg, 
        paddingVertical: spacing.xxl, 
        paddingHorizontal: spacing.xl, 
        backgroundColor: colors.emeraldDeep, 
        alignItems: 'center' 
      }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: colors.lineSoft, marginBottom: spacing.md }} />
        <Skeleton width={120} height={40} />
        <Skeleton width={80} height={14} style={{ marginTop: spacing.xs }} />
        <Skeleton width={200} height={12} style={{ marginTop: spacing.xs }} />
      </View>

      {/* Purpose stories metrics */}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ 
            flex: 1, 
            backgroundColor: colors.surface, 
            borderWidth: 1, 
            borderColor: colors.line, 
            borderRadius: radius.md, 
            paddingVertical: spacing.lg, 
            paddingHorizontal: spacing.md, 
            alignItems: 'center' 
          }}>
            <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.lineSoft, marginBottom: spacing.sm }} />
            <Skeleton width={40} height={20} />
            <Skeleton width={60} height={11} style={{ marginTop: spacing.xs }} />
            <Skeleton width="80%" height={10} style={{ marginTop: spacing.xs }} />
          </View>
        ))}
      </View>

      {/* Spending consistency heatmap */}
      <View style={{ 
        marginTop: spacing.xxl, 
        backgroundColor: colors.surface, 
        borderWidth: 1, 
        borderColor: colors.line, 
        borderRadius: radius.md, 
        padding: spacing.lg 
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg }}>
          <View style={{ width: 15, height: 15, borderRadius: radius.xs, backgroundColor: colors.lineSoft }} />
          <Skeleton width={160} height={16} />
        </View>
        <Skeleton width="100%" height={12} style={{ marginBottom: spacing.md }} />
        <View style={{ height: 100, backgroundColor: colors.lineSoft, borderRadius: radius.sm }} />
      </View>

      {/* Budget vs Actual */}
      <View style={{ 
        marginTop: spacing.xxl, 
        backgroundColor: colors.surface, 
        borderWidth: 1, 
        borderColor: colors.line, 
        borderRadius: radius.md, 
        padding: spacing.lg 
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg }}>
          <View style={{ width: 15, height: 15, borderRadius: radius.xs, backgroundColor: colors.lineSoft }} />
          <Skeleton width={140} height={16} />
        </View>
        <Skeleton width="100%" height={12} style={{ marginBottom: spacing.md }} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
              <Skeleton width={120} height={18} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <View style={{ width: 14, height: 14, borderRadius: radius.xs, backgroundColor: colors.lineSoft }} />
                <Skeleton width={40} height={14} />
              </View>
            </View>
            <View style={{ height: 8, backgroundColor: colors.lineSoft, borderRadius: radius.pill, marginBottom: spacing.xs }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={80} height={12} />
              <Skeleton width={60} height={12} />
            </View>
          </View>
        ))}
      </View>

      {/* Spending Trends */}
      <View style={{ 
        marginTop: spacing.xxl, 
        backgroundColor: colors.surface, 
        borderWidth: 1, 
        borderColor: colors.line, 
        borderRadius: radius.md, 
        padding: spacing.lg 
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg }}>
          <View style={{ width: 15, height: 15, borderRadius: radius.xs, backgroundColor: colors.lineSoft }} />
          <Skeleton width={130} height={16} />
        </View>
        <Skeleton width="100%" height={12} style={{ marginBottom: spacing.md }} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1, height: 36, borderRadius: radius.sm, backgroundColor: colors.lineSoft }} />
          ))}
        </View>
        <Skeleton width={80} height={12} style={{ marginBottom: spacing.xs }} />
        <Skeleton width={120} height={36} style={{ marginBottom: spacing.lg }} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.lineSoft }} />
                <Skeleton width={100} height={15} />
              </View>
              <Skeleton width={40} height={12} />
            </View>
            <View style={{ height: 8, backgroundColor: colors.lineSoft, borderRadius: radius.pill, marginBottom: spacing.xs }} />
            <Skeleton width={60} height={12} />
          </View>
        ))}
      </View>

      {/* Search bar */}
      <View style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
        <View style={{ 
          height: 44, 
          borderRadius: radius.sm, 
          backgroundColor: colors.surface, 
          borderWidth: 1, 
          borderColor: colors.line 
        }} />
      </View>

      {/* Spending behavior insights list */}
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lineSoft }} />
          <View style={{ flex: 1 }}>
            <Skeleton width="60%" height={16} style={{ marginBottom: spacing.xs }} />
            <Skeleton width="80%" height={12} />
          </View>
          <Skeleton width={40} height={10} />
        </View>
      ))}
    </View>
  );
}
