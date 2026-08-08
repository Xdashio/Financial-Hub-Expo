import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, radius, spacing, typography, shadow } from '../../src/theme';
import { Shield, RefreshCw, ChevronLeft } from 'lucide-react-native';
import { useHomeStore } from '@/services/home-store';
import { useAuthStore } from '@/services/auth';
import { Button } from '@/components/ui';

// Pocket icon components matching the mockup design
const PocketIconSavings = ({ color, size = 14 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}>
    <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43V6.9c1.1 0 1.98.37 2.63 1.06l.86-1.09c-.85-.74-2.06-1.28-3.49-1.28V4h-1.5v2.5c-1.9.32-3.15 1.53-3.15 3.03 0 1.67 1.31 2.69 3.15 3.14 1.97.47 2.34 1.09 2.34 1.99 0 1.03-1.01 1.56-2.29 1.56-1.32 0-2.31-.52-3.05-1.27l-.95 1.1c.94.96 2.25 1.53 3.8 1.53v2.5h1.5v-2.5c2.11-.32 3.32-1.68 3.32-3.25 0-1.82-1.5-2.82-3.05-3.27z" />
  </Svg>
);

const PocketIconRent = ({ color, size = 14 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}>
    <Path d="M3 21h18M5 21V7l8-4 8 4v14M8 21v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

const PocketIconGroceries = ({ color, size = 14 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}>
    <Path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-8 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
  </Svg>
);

const PocketIconPersonal = ({ color, size = 14 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </Svg>
);

const PocketIconTransport = ({ color, size = 14 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}>
    <Path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
    <Circle cx="7" cy="17" r="2" />
    <Circle cx="17" cy="17" r="2" />
  </Svg>
);

const PocketIconLock = ({ color, size = 13 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}>
    <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
    <Path d="M4 10h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10" />
  </Svg>
);

const getPocketIcon = (category?: string, kind?: string) => {
  switch (kind) {
    case 'savings':
      return PocketIconSavings;
    case 'fixed':
      // For fixed pockets, use category to determine icon
      switch (category) {
        case 'housing':
        case 'rent':
          return PocketIconRent;
        case 'utilities':
        case 'bills':
          return PocketIconRent;
        default:
          return PocketIconRent;
      }
    case 'spendable':
      switch (category) {
        case 'food':
        case 'groceries':
          return PocketIconGroceries;
        case 'transport':
          return PocketIconTransport;
        case 'leisure':
        case 'personal':
          return PocketIconPersonal;
        default:
          return PocketIconGroceries;
      }
    default:
      return PocketIconGroceries;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  brandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandGlyph: {
    width: 26,
    height: 26,
  },
  brandWordmark: {
    ...typography.heading,
    color: colors.ink,
    letterSpacing: -0.18,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.goldTint,
    color: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontFamily: typography.fontFamily,
  },
  balanceBlock: {
    marginTop: spacing.xl,
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.sage,
    letterSpacing: 0.36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  balanceValue: {
    ...typography.display,
    color: colors.emeraldDeep,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  balanceSub: {
    ...typography.caption,
    fontSize: 11,
    color: colors.sage,
    marginTop: spacing.xs,
  },
  balanceSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  balanceSecondaryLabel: {
    ...typography.caption,
    color: colors.sage,
  },
  balanceSecondaryValue: {
    ...typography.body,
    color: colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  protectStrip: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.emeraldTint,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  protectStripText: {
    ...typography.caption,
    color: colors.emeraldDeep,
  },
  sectionLabel: {
    ...typography.eyebrow,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  pocketCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.default,
  },
  pocketStitch: {
    borderTopWidth: 1.5,
    borderTopColor: colors.line,
    borderStyle: 'dashed',
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    paddingTop: spacing.lg,
  },
  pocketTab: {
    position: 'absolute',
    top: -4,
    left: 16,
    width: 34,
    height: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  pocketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  pocketNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pocketIconMain: {
    flexShrink: 0,
  },
  pocketName: {
    ...typography.heading,
    color: colors.ink,
  },
  pocketIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pocketLock: {
    color: colors.sage,
  },
  pocketAmount: {
    ...typography.body,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  pocketBarTrack: {
    height: 6,
    backgroundColor: colors.lineSoft,
    borderRadius: radius.pill,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  pocketBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  pocketMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  pocketMetaText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.sage,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.emeraldTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.ink,
  },
  emptySub: {
    ...typography.body,
    color: colors.sage,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 21,
  },
  dailyPocketCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.default,
  },
  dailyPocketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dailyPocketLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dailyPocketRight: {
    alignItems: 'flex-end',
  },
  dailyPocketRemaining: {
    ...typography.heading,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  dailyPocketCap: {
    ...typography.caption,
    color: colors.sage,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  dailyPocketBarTrack: {
    height: 6,
    backgroundColor: colors.lineSoft,
    borderRadius: radius.pill,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  dailyPocketBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  rolloverStrip: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rolloverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rolloverIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.xs,
    backgroundColor: colors.goldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolloverTitle: {
    ...typography.heading,
    color: colors.ink,
  },
  rolloverSub: {
    ...typography.caption,
    fontSize: 11,
    color: colors.sage,
    marginTop: 1,
  },
  rolloverValue: {
    ...typography.body,
    color: colors.emeraldDeep,
    fontVariant: ['tabular-nums'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  loadingText: {
    ...typography.body,
    color: colors.sage,
    marginTop: spacing.md,
  },
});

export default function HomeScreen() {
  const { 
    pockets, 
    dailyPockets, 
    planType,
    rolloverAmount, 
    safeToSpendToday, 
    totalBalance, 
    disciplineScore, 
    scoreDelta,
    isLoading, 
    error, 
    fetchHomeData,
    refreshData,
  } = useHomeStore();

  const user = useAuthStore(s => s.user);
  const initials = user?.fullName
    ?.split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() ?? '?';

  React.useEffect(() => {
    fetchHomeData();
  }, []);

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  const getPocketColor = (kind: string, category?: string) => {
    if (kind === 'fixed') return colors.gold;
    if (kind === 'savings') return colors.emeraldDeep;
    if (kind === 'spendable') {
      switch (category) {
        case 'food': return colors.emerald;
        case 'transport': return colors.plum;
        case 'leisure': return colors.clay;
        default: return colors.emerald;
      }
    }
    return colors.emerald;
  };

  const getPocketStatus = (pocket: any) => {
    if (pocket.kind === 'fixed') return { label: 'Settled', status: 'Settled' };
    if (pocket.kind === 'savings') return { label: 'Protected', status: 'Protected' };
    return { label: 'Monthly budget', status: 'Monthly budget' };
  };

  if (isLoading && pockets.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.emeraldDeep} />
            <Text style={styles.loadingText}>Loading your financial hub...</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <ChevronLeft size={32} color={colors.emeraldDeep} strokeWidth={2} />
            </View>
            <Text style={styles.emptyTitle}>Unable to load data</Text>
            <Text style={styles.emptySub}>{error}</Text>
            <Button fullWidth size="md" onPress={refreshData} style={{ marginTop: spacing.lg }}>
              Try Again
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (pockets.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Shield size={32} color={colors.emeraldDeep} strokeWidth={2} />
            </View>
            <Text style={styles.emptyTitle}>No plan yet</Text>
            <Text style={styles.emptySub}>
              Complete onboarding to see your personalized money plan with pockets for savings, fixed costs, and daily spending.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const fixedPockets = pockets.filter(p => p.kind === 'fixed' || p.kind === 'savings');
  // In the structured plan, spendable pockets don't have a daily cap — they're
  // shown as monthly-allocation cards alongside fixed & savings pockets
  // instead of the daily budget strip.
  const structuredSpendablePockets = pockets.filter(p => p.kind === 'spendable');
  const isDaily = planType === 'daily';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refreshData} tintColor={colors.emeraldDeep} colors={[colors.emeraldDeep]} />
        }
      >
        <View style={styles.brandBar}>
          <View style={styles.brandMark}>
            <Image
              source={require('../../assets/financial_hub_logo_transparent.png')}
              style={styles.brandGlyph}
              resizeMode="contain"
            />
            <Text style={styles.brandWordmark}>Financial Hub</Text>
          </View>
          <Text style={styles.avatar}>{initials}</Text>
        </View>

        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>Safe to spend today</Text>
          <Text style={styles.balanceValue}>{formatCurrency(safeToSpendToday)}</Text>
          <Text style={styles.balanceSub}>Sum of daily caps</Text>
        </View>

        <View style={styles.balanceSecondary}>
          <Text style={styles.balanceSecondaryLabel}>Total balance</Text>
          <Text style={styles.balanceSecondaryValue}>{formatCurrency(totalBalance)}</Text>
        </View>

        <View style={styles.protectStrip}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Shield size={14} color={colors.emeraldDeep} strokeWidth={2} style={{ marginRight: 4 }} />
            <Text style={styles.protectStripText}>Savings protected — unspent daily amounts roll over</Text>
          </View>
        </View>

        {isDaily && (
          <View style={styles.rolloverStrip}>
            <View style={styles.rolloverLeft}>
              <View style={styles.rolloverIcon}>
                <RefreshCw size={16} color={colors.gold} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.rolloverTitle}>Today's rollover</Text>
                <Text style={styles.rolloverSub}>Unspent amounts move to Savings at midnight</Text>
              </View>
            </View>
            <Text style={styles.rolloverValue}>{formatCurrency(rolloverAmount)}</Text>
          </View>
        )}

        {isDaily && dailyPockets.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Spendable pockets</Text>

            {dailyPockets.map((pocket, i) => {
              const PocketIcon = getPocketIcon(pocket.category);
              return (
                <View key={i} style={styles.dailyPocketCard}>
                  <View style={[styles.pocketStitch, { borderTopColor: pocket.color }]} />
                  <View style={[styles.pocketTab, { backgroundColor: pocket.color }]} />
                  <View style={styles.dailyPocketTop}>
                    <View style={styles.dailyPocketLeft}>
                      <PocketIcon color={pocket.color} size={14} />
                      <Text style={styles.pocketName}>{pocket.name}</Text>
                    </View>
                    <View style={styles.dailyPocketRight}>
                      <Text style={styles.dailyPocketRemaining}>{pocket.remaining} left</Text>
                      <Text style={styles.dailyPocketCap}>/ {pocket.cap} cap</Text>
                    </View>
                  </View>
                  <View style={styles.dailyPocketBarTrack}>
                    <View
                      style={[
                        styles.dailyPocketBarFill,
                        { backgroundColor: pocket.color, width: `${Math.max(0, Math.min(100, pocket.progress * 100))}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </>
        )}

        {!isDaily && structuredSpendablePockets.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Spendable pockets</Text>

            {structuredSpendablePockets.map((pocket, i) => {
              const pocketColor = getPocketColor(pocket.kind, pocket.category);
              const status = getPocketStatus(pocket);
              const PocketIcon = getPocketIcon(pocket.category, pocket.kind);
              return (
                <View key={i} style={styles.pocketCard}>
                  <View style={[styles.pocketStitch, { borderTopColor: pocketColor }]} />
                  <View style={[styles.pocketTab, { backgroundColor: pocketColor }]} />
                  <View style={styles.pocketTop}>
                    <View style={styles.pocketNameRow}>
                      <PocketIcon color={pocketColor} size={14} />
                      <Text style={styles.pocketName}>{pocket.name}</Text>
                    </View>
                    <View style={styles.pocketIcons}>
                      <Text style={styles.pocketAmount}>{formatCurrency(pocket.monthlyAllocation)}</Text>
                    </View>
                  </View>
                  <View style={styles.pocketBarTrack}>
                    <View
                      style={[
                        styles.pocketBarFill,
                        { backgroundColor: pocketColor, width: '100%' },
                      ]}
                    />
                  </View>
                  <View style={styles.pocketMeta}>
                    <Text style={styles.pocketMetaText}>{status.label}</Text>
                    <Text style={styles.pocketMetaText}>Available</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {fixedPockets.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Fixed & Protected</Text>

            {fixedPockets.map((pocket, i) => {
              const pocketColor = getPocketColor(pocket.kind, pocket.category);
              const status = getPocketStatus(pocket);
              const PocketIcon = getPocketIcon(pocket.category, pocket.kind);
              return (
                <View key={i} style={styles.pocketCard}>
                  <View style={[styles.pocketStitch, { borderTopColor: pocketColor }]} />
                  <View style={[styles.pocketTab, { backgroundColor: pocketColor }]} />
                  <View style={styles.pocketTop}>
                    <View style={styles.pocketNameRow}>
                      <PocketIcon color={pocketColor} size={14} />
                      <Text style={styles.pocketName}>{pocket.name}</Text>
                    </View>
                    <View style={styles.pocketIcons}>
                      {pocket.isTimeLocked && (
                        <PocketIconLock color={colors.sage} size={13} />
                      )}
                      <Text style={styles.pocketAmount}>{formatCurrency(pocket.monthlyAllocation)}</Text>
                    </View>
                  </View>
                  <View style={styles.pocketBarTrack}>
                    <View
                      style={[
                        styles.pocketBarFill,
                        { backgroundColor: pocketColor, width: '100%' },
                      ]}
                    />
                  </View>
                  <View style={styles.pocketMeta}>
                    <Text style={styles.pocketMetaText}>{status.label}</Text>
                    <Text style={styles.pocketMetaText}>{pocket.isTimeLocked ? 'Locked' : 'Available'}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {pockets.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Shield size={32} color={colors.emeraldDeep} strokeWidth={2} />
            </View>
            <Text style={styles.emptyTitle}>No plan yet</Text>
            <Text style={styles.emptySub}>
              Complete onboarding to see your personalized money plan with pockets for savings, fixed costs, and daily spending.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatCurrency(amount: number) {
  return `KES ${amount.toLocaleString()}`;
}