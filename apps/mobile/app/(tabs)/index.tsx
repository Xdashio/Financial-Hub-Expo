import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { colors, radius, spacing, typography, shadow } from '../../src/theme';
import { Shield, RefreshCw, Lock, ChevronLeft } from 'lucide-react-native';
import { useHomeStore } from '@/services/home-store';
import { useAuthStore } from '@/services/auth';
import { Button } from '@/components/ui';

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
  pocketDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pocketName: {
    ...typography.heading,
    color: colors.ink,
  },
  pocketAmount: {
    ...typography.body,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
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

            {dailyPockets.map((pocket, i) => (
              <View key={i} style={styles.dailyPocketCard}>
                <View style={styles.dailyPocketTop}>
                  <View style={styles.dailyPocketLeft}>
                    <View style={[styles.pocketDot, { backgroundColor: pocket.color }]} />
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
            ))}
          </>
        )}

        {!isDaily && structuredSpendablePockets.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Spendable pockets</Text>

            {structuredSpendablePockets.map((pocket, i) => {
              const pocketColor = getPocketColor(pocket.kind, pocket.category);
              const status = getPocketStatus(pocket);
              return (
                <View key={i} style={styles.pocketCard}>
                  <View style={styles.pocketTop}>
                    <View style={styles.pocketNameRow}>
                      <View style={[styles.pocketDot, { backgroundColor: pocketColor }]} />
                      <Text style={styles.pocketName}>{pocket.name}</Text>
                    </View>
                    <Text style={styles.pocketAmount}>{formatCurrency(pocket.monthlyAllocation)}</Text>
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
              return (
                <View key={i} style={styles.pocketCard}>
                  <View style={styles.pocketTop}>
                    <View style={styles.pocketNameRow}>
                      <View style={[styles.pocketDot, { backgroundColor: pocketColor }]} />
                      <Text style={styles.pocketName}>{pocket.name}</Text>
                      {pocket.isTimeLocked && (
                        <Lock size={12} color={colors.sage} strokeWidth={2.5} />
                      )}
                    </View>
                    <Text style={styles.pocketAmount}>{formatCurrency(pocket.monthlyAllocation)}</Text>
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