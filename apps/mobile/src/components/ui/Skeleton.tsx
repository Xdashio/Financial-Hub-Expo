import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, AccessibilityInfo } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, shadow } from '@/theme';

/**
 * 2026 skeleton primitive — pulse-based, theme-token driven, accessible.
 *
 * Best-practice stack (Jan 2026 research):
 * - Pulse opacity 0.30→1 over 800ms, useNativeDriver:true (GPU, not JS thread)
 * - Single shared Animated.Value per screen would be ideal for 10+ items;
 *   per-block pulse is acceptable for ≤6 items (cap at 6–10 placeholders)
 * - Base color = colors.lineSoft (light #E0E1DA / dark #3A4A42) — theme token, not hardcoded #E0E0E0
 * - Respect reduceMotion: AccessibilityInfo.isReduceMotionEnabled() → static
 * - Hide from screen readers: accessible={false}, importantForAccessibility="no-hide-descendants"
 * - Match real layout exactly: same width/height/radius/padding as final component to avoid layout shift
 * - No shimmer gradient by default — pulse is lighter on battery and less busy; shimmer only for hero
 */
export function Skeleton({
  width,
  height,
  style,
  borderRadius,
}: {
  width?: number | string;
  height?: number | string;
  style?: any;
  borderRadius?: number;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = (AccessibilityInfo as any).addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, opacity]);

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: width || '100%',
          height: height || 14,
          borderRadius: borderRadius ?? 6,
          backgroundColor: colors.lineSoft,
          opacity: reduceMotion ? 1 : opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Generic card skeleton — 3 lines, matches Card layout (padding lg, radius md)
 */
export function CardSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        padding: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        marginBottom: spacing.md,
        gap: spacing.sm,
      }}
    >
      <Skeleton width="55%" height={18} borderRadius={6} />
      <Skeleton width="100%" height={12} borderRadius={4} />
      <Skeleton width="78%" height={12} borderRadius={4} />
    </View>
  );
}

export function ListItemSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        marginBottom: spacing.sm,
        gap: spacing.md,
      }}
    >
      <Skeleton width={40} height={40} borderRadius={radius.xs} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Skeleton width="65%" height={14} borderRadius={4} />
        <Skeleton width="45%" height={11} borderRadius={4} />
      </View>
      <Skeleton width={48} height={14} borderRadius={4} />
    </View>
  );
}

export function PocketSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radius.sm,
        padding: spacing.lg,
        marginBottom: spacing.md,
        ...shadow.default,
      }}
    >
      <View style={{ borderTopWidth: 1.5, borderTopColor: colors.lineSoft, borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
      <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.lineSoft }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
        <Skeleton width={28} height={28} borderRadius={radius.xs} />
        <View style={{ flex: 1, gap: 4 }}>
          <Skeleton width="50%" height={15} borderRadius={4} />
          <Skeleton width="35%" height={10} borderRadius={4} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Skeleton width={72} height={15} borderRadius={4} />
          <Skeleton width={52} height={10} borderRadius={radius.pill} />
        </View>
      </View>
      <Skeleton width="100%" height={6} borderRadius={radius.pill} style={{ marginTop: spacing.md }} />
      <Skeleton width="45%" height={10} borderRadius={4} style={{ marginTop: spacing.xs }} />
    </View>
  );
}

/**
 * Personal Home — mirrors (tabs)/index.tsx exactly:
 * header 26+38, safe-to-spend display 40, runway 28+card, 3 quick actions (not 4), pocket sections 3 cards
 */
export function HomeSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 0 }}>
      {/* Header — logo 26 + Bell 38 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Skeleton width={26} height={26} borderRadius={radius.xs} />
          <Skeleton width={110} height={16} borderRadius={4} />
        </View>
        <Skeleton width={38} height={38} borderRadius={radius.sm} />
      </View>
      {/* Toggle pill — Personal/Business */}
      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, padding: 3 }}>
        <Skeleton width={72} height={24} borderRadius={radius.pill} />
        <Skeleton width={72} height={24} borderRadius={radius.pill} />
      </View>
      {/* Safe to spend */}
      <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
        <Skeleton width={110} height={11} borderRadius={4} />
        <Skeleton width={160} height={32} borderRadius={6} />
        <Skeleton width={190} height={10} borderRadius={4} />
      </View>
      {/* Runway */}
      <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 }}>
        <Skeleton width={28} height={28} borderRadius={radius.pill} />
        <View style={{ flex: 1, gap: 4 }}>
          <Skeleton width={130} height={14} borderRadius={4} />
          <Skeleton width="85%" height={10} borderRadius={4} />
        </View>
      </View>
      {/* Total balance row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.lineSoft }}>
        <Skeleton width={88} height={11} borderRadius={4} />
        <Skeleton width={84} height={14} borderRadius={4} />
      </View>
      {/* Protection banner */}
      <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Skeleton width={14} height={14} borderRadius={4} />
        <Skeleton width="85%" height={11} borderRadius={4} />
      </View>
      {/* Quick actions — 3, not 4, each  surface  minHeight 44  icon 18 */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', gap: spacing.xs }}>
            <Skeleton width={24} height={24} borderRadius={radius.pill} />
            <Skeleton width={56} height={11} borderRadius={4} />
          </View>
        ))}
      </View>
      <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
        <Skeleton width={140} height={11} borderRadius={4} />
      </View>
      {/* Pocket sections — 2 cards, not 3, single column */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton width={140} height={11} borderRadius={4} />
          <Skeleton width={70} height={11} borderRadius={4} />
        </View>
        {[1, 2].map(i => (
          <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.lg, ...shadow.default }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Skeleton width={28} height={28} borderRadius={radius.xs} />
              <View style={{ flex: 1, gap: 4 }}>
                <Skeleton width="45%" height={14} borderRadius={4} />
                <Skeleton width="30%" height={10} borderRadius={4} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Skeleton width={64} height={14} borderRadius={4} />
                <Skeleton width={48} height={10} borderRadius={radius.pill} />
              </View>
            </View>
            <Skeleton width="100%" height={6} borderRadius={radius.pill} style={{ marginTop: spacing.md }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * MSME Home — mirrors (msme)/index.tsx new aligned layout:
 * header logo, toggle pill, hero Total in business pockets, monthly row, banner, 3 actions, Business pockets, Operations
 */
export function MsmeHomeSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Skeleton width={26} height={26} borderRadius={radius.xs} />
        <Skeleton width={110} height={16} borderRadius={4} />
      </View>
      {/* Toggle */}
      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, padding: 3 }}>
        <Skeleton width={72} height={24} borderRadius={radius.pill} />
        <Skeleton width={72} height={24} borderRadius={radius.pill} />
      </View>
      {/* Hero */}
      <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
        <Skeleton width={160} height={11} borderRadius={4} />
        <Skeleton width={170} height={32} borderRadius={6} />
        <Skeleton width={220} height={10} borderRadius={4} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.lineSoft }}>
        <Skeleton width={110} height={11} borderRadius={4} />
        <Skeleton width={88} height={14} borderRadius={4} />
      </View>
      <View style={{ marginTop: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <Skeleton width={14} height={14} borderRadius={4} />
        <Skeleton width="80%" height={11} borderRadius={4} />
      </View>
      {/* Action row 3 */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', gap: spacing.xs }}>
            <Skeleton width={24} height={24} borderRadius={radius.pill} />
            <Skeleton width={52} height={11} borderRadius={4} />
          </View>
        ))}
      </View>
      <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
        <Skeleton width={160} height={11} borderRadius={4} />
      </View>
      {/* Business pockets header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.md }}>
        <Skeleton width={130} height={11} borderRadius={4} />
        <Skeleton width={48} height={18} borderRadius={radius.pill} />
      </View>
      {/* Search */}
      <Skeleton width="100%" height={44} borderRadius={radius.md} style={{ marginBottom: spacing.md }} />
      {/* Pocket cards 2 */}
      {[1, 2].map(i => (
        <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.lg, marginBottom: spacing.md, ...shadow.default }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Skeleton width={28} height={28} borderRadius={radius.xs} />
            <View style={{ flex: 1, gap: 4 }}>
              <Skeleton width="45%" height={14} borderRadius={4} />
              <Skeleton width="30%" height={10} borderRadius={4} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Skeleton width={64} height={14} borderRadius={4} />
              <Skeleton width={48} height={10} borderRadius={radius.pill} />
            </View>
          </View>
          <Skeleton width="100%" height={6} borderRadius={radius.pill} style={{ marginTop: spacing.md }} />
        </View>
      ))}
      {/* Operations */}
      <Skeleton width={100} height={11} borderRadius={4} style={{ marginTop: spacing.xl, marginBottom: spacing.md }} />
      {[1, 2, 3].map(i => (
        <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Skeleton width={40} height={40} borderRadius={radius.md} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={14} borderRadius={4} />
            <Skeleton width="90%" height={10} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function PocketDetailSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <Skeleton width={24} height={24} borderRadius={radius.xs} />
        <Skeleton width={140} height={18} borderRadius={4} />
      </View>
      {/* Hero dark card — match heroBg with top dash */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
        <View style={{ backgroundColor: colors.heroBg, borderRadius: radius.sm, padding: spacing.lg, paddingTop: spacing.xl }}>
          <Skeleton width={120} height={10} borderRadius={4} style={{ backgroundColor: colors.heroText + '22' } as any} />
          <Skeleton width={160} height={34} borderRadius={6} style={{ marginTop: spacing.sm, backgroundColor: colors.heroText + '22' } as any} />
          <Skeleton width={200} height={10} borderRadius={4} style={{ marginTop: spacing.xs, backgroundColor: colors.heroText + '22' } as any} />
          <Skeleton width="100%" height={6} borderRadius={radius.pill} style={{ marginTop: spacing.lg, backgroundColor: colors.heroText + '14' } as any} />
          <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ gap: 4 }}>
                <Skeleton width={52} height={10} borderRadius={4} style={{ backgroundColor: colors.heroText + '22' } as any} />
                <Skeleton width={64} height={14} borderRadius={4} style={{ backgroundColor: colors.heroText + '22' } as any} />
              </View>
            ))}
          </View>
        </View>
      </View>
      {/* Stats row */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm }}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ flex: 1, padding: spacing.md, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.sm, gap: 6, backgroundColor: colors.surface }}>
            <Skeleton width={64} height={10} borderRadius={4} />
            <Skeleton width={52} height={14} borderRadius={4} />
          </View>
        ))}
      </View>
      {/* Sub-pockets */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <Skeleton width={120} height={11} borderRadius={4} style={{ marginBottom: spacing.md }} />
        {[1, 2].map(i => (
          <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Skeleton width={32} height={32} borderRadius={radius.md} />
            <View style={{ flex: 1, gap: 4 }}>
              <Skeleton width="50%" height={14} borderRadius={4} />
              <Skeleton width="35%" height={10} borderRadius={4} />
            </View>
            <Skeleton width={64} height={12} borderRadius={4} />
          </View>
        ))}
      </View>
      {/* Transactions */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <Skeleton width={110} height={11} borderRadius={4} style={{ marginBottom: spacing.md }} />
        {[1, 2, 3].map(i => (
          <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Skeleton width={36} height={36} borderRadius={radius.pill} />
            <View style={{ flex: 1, gap: 4 }}>
              <Skeleton width="60%" height={14} borderRadius={4} />
              <Skeleton width="45%" height={10} borderRadius={4} />
            </View>
            <Skeleton width={64} height={14} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function ProjectDetailSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <Skeleton width={24} height={24} borderRadius={radius.xs} />
        <View style={{ flex: 1, gap: 4 }}>
          <Skeleton width={140} height={16} borderRadius={4} />
          <Skeleton width={100} height={10} borderRadius={4} />
        </View>
      </View>
      {/* Status row 3 pills */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <Skeleton width={68} height={22} borderRadius={radius.pill} />
        <Skeleton width={88} height={22} borderRadius={radius.pill} />
        <Skeleton width={72} height={22} borderRadius={radius.pill} />
      </View>
      {/* Hero dark */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
        <View style={{ backgroundColor: colors.heroBg, borderRadius: radius.sm, padding: spacing.lg, paddingTop: spacing.xl }}>
          <Skeleton width={140} height={10} borderRadius={4} style={{ backgroundColor: colors.heroText + '22' } as any} />
          <Skeleton width={160} height={34} borderRadius={6} style={{ marginTop: spacing.sm, backgroundColor: colors.heroText + '22' } as any} />
          <Skeleton width={210} height={10} borderRadius={4} style={{ marginTop: spacing.xs, backgroundColor: colors.heroText + '22' } as any} />
          <Skeleton width="100%" height={6} borderRadius={radius.pill} style={{ marginTop: spacing.lg, backgroundColor: colors.heroText + '14' } as any} />
          {/* 3 mini bars */}
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Skeleton width={64} height={10} borderRadius={4} style={{ backgroundColor: colors.heroText + '22' } as any} />
                <Skeleton width="100%" height={4} borderRadius={radius.pill} style={{ flex: 1, backgroundColor: colors.heroText + '14' } as any} />
                <Skeleton width={28} height={10} borderRadius={4} style={{ backgroundColor: colors.heroText + '22' } as any} />
              </View>
            ))}
          </View>
          <Skeleton width={200} height={28} borderRadius={radius.md} style={{ marginTop: spacing.md, backgroundColor: colors.heroText + '0A' } as any} />
        </View>
      </View>
      {/* Spending controls */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: spacing.md }}>
          <Skeleton width={130} height={11} borderRadius={4} />
          <Skeleton width="90%" height={10} borderRadius={4} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 4 }}>
              <Skeleton width={88} height={14} borderRadius={4} />
              <Skeleton width={120} height={10} borderRadius={4} />
            </View>
            <Skeleton width={44} height={24} borderRadius={radius.pill} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 4 }}>
              <Skeleton width={110} height={14} borderRadius={4} />
              <Skeleton width={140} height={10} borderRadius={4} />
            </View>
            <Skeleton width={44} height={24} borderRadius={radius.pill} />
          </View>
        </View>
      </View>
      {/* Actions */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm }}>
        <Skeleton width="100%" height={44} borderRadius={radius.button} />
        <Skeleton width="100%" height={44} borderRadius={radius.button} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Skeleton width="48%" height={44} borderRadius={radius.button} />
          <Skeleton width="48%" height={44} borderRadius={radius.button} />
        </View>
      </View>
      {/* Tier cards 3 */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md }}>
        <Skeleton width={160} height={11} borderRadius={4} />
        {[1, 2, 3].map(i => (
          <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={80} height={11} borderRadius={4} />
              <Skeleton width={72} height={22} borderRadius={radius.pill} />
            </View>
            <Skeleton width="100%" height={6} borderRadius={radius.pill} />
            <Skeleton width="100%" height={1} borderRadius={0} style={{ backgroundColor: colors.lineSoft } as any} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={48} height={10} borderRadius={4} />
              <Skeleton width={88} height={14} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function LoansSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Skeleton width={24} height={24} borderRadius={radius.xs} />
          <Skeleton width={60} height={18} borderRadius={4} />
        </View>
        <Skeleton width={200} height={11} borderRadius={4} />
      </View>
      {/* Segment pills */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
        <Skeleton width={72} height={28} borderRadius={radius.pill} />
        <Skeleton width={72} height={28} borderRadius={radius.pill} />
      </View>
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
        <Skeleton width="100%" height={44} borderRadius={radius.button} />
      </View>
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.md }}>
        {[1, 2].map(i => (
          <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ gap: 4 }}>
                <Skeleton width={120} height={15} borderRadius={4} />
                <Skeleton width={80} height={10} borderRadius={4} />
              </View>
              <Skeleton width={60} height={20} borderRadius={radius.pill} />
            </View>
            <Skeleton width="100%" height={6} borderRadius={radius.pill} />
            <Skeleton width="90%" height={10} borderRadius={4} />
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.lineSoft }}>
              <Skeleton width={16} height={16} borderRadius={4} />
              <Skeleton width={180} height={11} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ProjectsSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs }}>
        <Skeleton width={90} height={22} borderRadius={4} />
        <Skeleton width={220} height={11} borderRadius={4} />
      </View>
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <Skeleton width="100%" height={44} borderRadius={radius.md} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} width={64} height={28} borderRadius={radius.pill} />
        ))}
      </View>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        {[1, 2].map(i => (
          <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, ...shadow.default }}>
            <View style={{ gap: spacing.xs }}>
              <Skeleton width={140} height={10} borderRadius={4} />
              <Skeleton width="70%" height={18} borderRadius={4} />
              <Skeleton width={160} height={10} borderRadius={4} />
            </View>
            <Skeleton width="100%" height={8} borderRadius={radius.pill} />
            <View style={{ gap: spacing.sm }}>
              {[1, 2, 3].map(j => (
                <View key={j} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Skeleton width={64} height={10} borderRadius={4} />
                    <Skeleton width={120} height={10} borderRadius={4} />
                  </View>
                  <Skeleton width="100%" height={6} borderRadius={radius.pill} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function InvoicesSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs }}>
        <Skeleton width={90} height={22} borderRadius={4} />
        <Skeleton width={220} height={11} borderRadius={4} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: 6 }}>
          <Skeleton width={72} height={10} borderRadius={4} />
          <Skeleton width={88} height={16} borderRadius={4} />
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: 6 }}>
          <Skeleton width={52} height={10} borderRadius={4} />
          <Skeleton width={32} height={16} borderRadius={4} />
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <Skeleton width="100%" height={44} borderRadius={radius.md} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} width={56} height={28} borderRadius={radius.pill} />
        ))}
      </View>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ gap: 4 }}>
                <Skeleton width={120} height={14} borderRadius={4} />
                <Skeleton width={160} height={10} borderRadius={4} />
              </View>
              <Skeleton width={64} height={20} borderRadius={radius.pill} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={88} height={14} borderRadius={4} />
              <Skeleton width={72} height={10} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function StockSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs }}>
        <Skeleton width={70} height={22} borderRadius={4} />
        <Skeleton width={180} height={11} borderRadius={4} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: 6 }}>
          <Skeleton width={72} height={10} borderRadius={4} />
          <Skeleton width={48} height={16} borderRadius={4} />
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: 6 }}>
          <Skeleton width={48} height={10} borderRadius={4} />
          <Skeleton width={64} height={16} borderRadius={4} />
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <Skeleton width="100%" height={44} borderRadius={radius.button} />
      </View>
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <Skeleton width="100%" height={44} borderRadius={radius.md} />
      </View>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={100} height={14} borderRadius={4} />
              <Skeleton width={52} height={14} borderRadius={radius.pill} />
            </View>
            <Skeleton width={140} height={10} borderRadius={4} />
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 4 }}>
                <Skeleton width={52} height={10} borderRadius={4} />
                <Skeleton width={32} height={18} borderRadius={4} />
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 4 }}>
                <Skeleton width={40} height={10} borderRadius={4} />
                <Skeleton width={64} height={14} borderRadius={4} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function InvoiceDetailSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
      <Skeleton width={48} height={14} borderRadius={4} style={{ marginBottom: spacing.md }} />
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ gap: 6 }}>
            <Skeleton width={140} height={18} borderRadius={4} />
            <Skeleton width={160} height={12} borderRadius={4} />
          </View>
          <Skeleton width={64} height={20} borderRadius={radius.pill} />
        </View>
        <Skeleton width={160} height={28} borderRadius={6} />
        <Skeleton width={120} height={11} borderRadius={4} />
        <View style={{ height: 1, backgroundColor: colors.lineSoft, marginVertical: spacing.sm }} />
        <View style={{ gap: spacing.sm }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={72} height={11} borderRadius={4} />
              <Skeleton width={88} height={11} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Skeleton width="100%" height={44} borderRadius={radius.button} />
        <Skeleton width="100%" height={44} borderRadius={radius.button} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Skeleton width="48%" height={40} borderRadius={radius.button} />
          <Skeleton width="48%" height={40} borderRadius={radius.button} />
        </View>
      </View>
    </View>
  );
}

export function StockDetailSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
      <Skeleton width={48} height={14} borderRadius={4} style={{ marginBottom: spacing.md }} />
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
        <Skeleton width={140} height={18} borderRadius={4} />
        <Skeleton width={100} height={11} borderRadius={4} />
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 6 }}>
            <Skeleton width={52} height={10} borderRadius={4} />
            <Skeleton width={48} height={22} borderRadius={4} />
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 6 }}>
            <Skeleton width={40} height={10} borderRadius={4} />
            <Skeleton width={64} height={14} borderRadius={4} />
          </View>
        </View>
      </View>
      <View style={{ marginTop: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
        <Skeleton width={120} height={14} borderRadius={4} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Skeleton width={32} height={11} borderRadius={4} />
            <Skeleton width="100%" height={44} borderRadius={radius.md} />
          </View>
          <View style={{ flex: 2, gap: 4 }}>
            <Skeleton width={48} height={11} borderRadius={4} />
            <Skeleton width="100%" height={44} borderRadius={radius.md} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Skeleton width="48%" height={44} borderRadius={radius.button} />
          <Skeleton width="48%" height={44} borderRadius={radius.button} />
        </View>
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <Skeleton width={120} height={14} borderRadius={4} style={{ marginBottom: spacing.md }} />
        {[1, 2].map(i => (
          <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 4 }}>
              <Skeleton width={48} height={10} borderRadius={4} />
              <Skeleton width={120} height={10} borderRadius={4} />
            </View>
            <Skeleton width={64} height={12} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function InsightsSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ paddingHorizontal: spacing.lg }}>
      <Skeleton width={100} height={22} borderRadius={4} style={{ marginTop: spacing.sm }} />
      <View style={{ marginTop: spacing.xl, borderRadius: radius.lg, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, backgroundColor: colors.emeraldDeep, alignItems: 'center', gap: spacing.sm }}>
        <Skeleton width={120} height={120} borderRadius={60} style={{ backgroundColor: colors.heroText + '22' } as any} />
        <Skeleton width={88} height={28} borderRadius={6} style={{ backgroundColor: colors.heroText + '22' } as any} />
        <Skeleton width={140} height={10} borderRadius={4} style={{ backgroundColor: colors.heroText + '22' } as any} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, alignItems: 'center', gap: spacing.xs }}>
            <Skeleton width={28} height={28} borderRadius={radius.pill} />
            <Skeleton width={36} height={16} borderRadius={4} />
            <Skeleton width={64} height={10} borderRadius={4} />
          </View>
        ))}
      </View>
      <View style={{ marginTop: spacing.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Skeleton width={16} height={16} borderRadius={4} />
          <Skeleton width={140} height={14} borderRadius={4} />
        </View>
        <Skeleton width="100%" height={10} borderRadius={4} />
        <Skeleton width="100%" height={80} borderRadius={radius.sm} />
      </View>
      <View style={{ marginTop: spacing.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Skeleton width={16} height={16} borderRadius={4} />
          <Skeleton width={120} height={14} borderRadius={4} />
        </View>
        {[1, 2].map(i => (
          <View key={i} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={100} height={14} borderRadius={4} />
              <Skeleton width={56} height={10} borderRadius={4} />
            </View>
            <Skeleton width="100%" height={6} borderRadius={radius.pill} />
          </View>
        ))}
      </View>
    </View>
  );
}
