import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarCheck, ArrowLeftRight, Timer, TrendingUp, TrendingDown, PieChart, Briefcase, Target, Clock, Shield } from 'lucide-react-native';
import { radius, spacing, typography, shadow, categoryColors } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { insightsApi, reallocationsApi, pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { ScreenContainer, LoadingState, ErrorState, InlineLoading, SearchBar, EmptyState, ProgressRing } from '@/components/ui';
import { StreakHeatmap } from '@/components/insights/StreakHeatmap';
import { mapBehaviorEvent } from '@/utils/behaviorEvent';
import { formatMoney } from '@/utils/money';

interface DisplayEvent {
  title: string;
  desc: string;
  time: string;
  color: string;
}

function isSameMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function scoreBandLabel(score: number): string {
  if (score >= 70) return 'Steady';
  if (score >= 40) return 'Under pressure';
  return 'Needs a reset';
}

function disciplineMomentumCopy(delta: number, score: number): string {
  if (score <= 25) {
    if (delta < 0) {
      return `Recent drag: ${delta} pts this period. The floor is 0 — recovery starts with the next under-cap day.`;
    }
    if (delta > 0) {
      return `Climbing back: +${delta} pts this period. Keep pockets on purpose.`;
    }
    return 'At the floor for now — one under-cap day or an unbroken cooling-off starts the rebuild.';
  }
  if (delta > 0) {
    return `What moved it: +${delta} pts from under-cap days and staying on purpose.`;
  }
  if (delta < 0) {
    return `What moved it: ${delta} pts from over-cap days or cooling-off skips.`;
  }
  return 'What moved it: steady this period — keep pockets on purpose.';
}

interface Metric {
  label: string;
  value: string;
  story: string;
  icon: any;
  color: string;
}

export default function InsightsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [score, setScore] = React.useState<number | null>(null);
  const [delta, setDelta] = React.useState(0);
  const [scorePeriod, setScorePeriod] = React.useState('');
  const [hasScoreHistory, setHasScoreHistory] = React.useState(false);
  const [cardOrder, setCardOrder] = React.useState<string[]>([]);
  const [events, setEvents] = React.useState<any[]>([]);
  const [reallocationsThisMonth, setReallocationsThisMonth] = React.useState(0);
  const [coolingOffSkips, setCoolingOffSkips] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [pockets, setPockets] = React.useState<any[]>([]);
  const [budgetComparison, setBudgetComparison] = React.useState<any[]>([]);
  const [spendingTrends, setSpendingTrends] = React.useState<any[]>([]);
  const [selectedTrendPeriod, setSelectedTrendPeriod] = React.useState<'7' | '30' | '90'>('30');
  const [trendData, setTrendData] = React.useState<{ period: string; total: number; breakdown: any[] } | null>(null);
  
  // MSME Insights state (Phase 6 + 020 operational)
  const [segment, setSegment] = React.useState<'individual' | 'msme'>('individual');
  const [msmeInsights, setMsmeInsights] = React.useState<any>(null);
  const [msmeOperational, setMsmeOperational] = React.useState<any>(null);
  const [msmeLoading, setMsmeLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [scoreRes, eventsRes, reallocRes, pocketsRes] = await Promise.all([
        insightsApi.getDisciplineScore(),
        insightsApi.getBehaviorEventsPaginated(1, 20),
        reallocationsApi.getAll().catch(() => []),
        pocketsApi.getAll().catch(() => []),
      ]);
      setScore(scoreRes?.score ?? null);
      setDelta(scoreRes?.delta ?? 0);
      setScorePeriod(scoreRes?.period ?? '');
      setHasScoreHistory(scoreRes?.hasHistory ?? false);
      setCardOrder(Array.isArray(scoreRes?.cardOrder) ? scoreRes.cardOrder : []);
      setEvents(Array.isArray(eventsRes?.events) ? eventsRes.events : []);
      setPage(1);
      setHasMore((eventsRes?.pagination?.page ?? 1) < (eventsRes?.pagination?.totalPages ?? 1));

      const reallocs = Array.isArray(reallocRes) ? reallocRes : [];
      const completedThisMonth = reallocs.filter(
        (r: any) => r.status === 'completed' && r.completed_at && isSameMonth(r.completed_at)
      );
      setReallocationsThisMonth(completedThisMonth.length);
      setCoolingOffSkips(completedThisMonth.filter((r: any) => (r.discipline_cost ?? 0) > 0).length);

      // Calculate budget comparison
      const pocketsData = Array.isArray(pocketsRes) ? pocketsRes : [];
      setPockets(pocketsData);
      
      const budgetComparisonData = pocketsData
        .filter(p => p.kind === 'spendable' && p.category)
        .map(pocket => {
          const monthlyAllocation = pocket.monthly_allocation ?? 0;
          const availableBalance = pocket.available_balance ?? 0;
          // Use the ledger's real spend total directly rather than
          // monthlyAllocation - availableBalance: for a daily-cap pocket,
          // that subtraction also folds in the nightly rollover sweep
          // (unspent daily amounts leaving for Savings), which drains
          // availableBalance without any real spending happening — a
          // disciplined saver banking rollover credits every night would
          // otherwise read as having spent that money, and could even
          // wrongly show isOverBudget once enough nights had rolled over.
          const spent = pocket.spent ?? Math.max(0, monthlyAllocation - availableBalance);
          const percentage = monthlyAllocation > 0 ? (spent / monthlyAllocation) * 100 : 0;
          const isOverBudget = spent > monthlyAllocation;
          
          return {
            id: pocket.id,
            name: pocket.name,
            category: pocket.category,
            monthlyAllocation,
            spent,
            remaining: availableBalance,
            percentage: Math.min(100, Math.max(0, percentage)),
            isOverBudget,
          };
        });
      
      setBudgetComparison(budgetComparisonData);

      // For spending trends, we'll use behavior events
      // Group spending by category from daily_overspend events
      const categorySpending: Record<string, number> = {};
      let totalSpending = 0;
      
      events.forEach(event => {
        if (event.type === 'daily_overspend') {
          const payload = event.payload || {};
          const category = payload.category || 'other';
          const amount = payload.amount || 0;
          categorySpending[category] = (categorySpending[category] || 0) + amount;
          totalSpending += amount;
        }
      });
      
      const breakdown = Object.entries(categorySpending)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);
      
      setTrendData({
        period: selectedTrendPeriod,
        total: totalSpending,
        breakdown,
      });

      // Load MSME insights if segment is MSME — operational (invoices + projects) + legacy
      if (segment === 'msme') {
        setMsmeLoading(true);
        try {
          const [legacy, operational] = await Promise.all([
            insightsApi.getMsmeInsights().catch(() => null),
            insightsApi.getMsmeOperational().catch(() => null),
          ]);
          setMsmeInsights(legacy);
          setMsmeOperational(operational);
        } catch (e) {
          console.error('MSME insights load error:', e);
          setMsmeInsights(null);
          setMsmeOperational(null);
        } finally {
          setMsmeLoading(false);
        }
      }
    } catch (e) {
      console.error('Insights load error:', e);
      setLoadError('Failed to load your insights. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [segment]);

  // Recalculate trends when period changes
  React.useEffect(() => {
    if (events.length > 0) {
      // Group spending by category from daily_overspend events
      const categorySpending: Record<string, number> = {};
      let totalSpending = 0;
      
      events.forEach(event => {
        if (event.type === 'daily_overspend') {
          const payload = event.payload || {};
          const category = payload.category || 'other';
          const amount = payload.amount || 0;
          categorySpending[category] = (categorySpending[category] || 0) + amount;
          totalSpending += amount;
        }
      });
      
      const breakdown = Object.entries(categorySpending)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);
      
      setTrendData({
        period: selectedTrendPeriod,
        total: totalSpending,
        breakdown,
      });
    }
  }, [selectedTrendPeriod, events]);
  // (unlocking a pocket, completing a reallocation) that aren't this one —
  // a plain mount-time useEffect left this tab showing a stale score after
  // an action taken elsewhere until the app was reloaded. Refetching on
  // focus keeps it current every time the tab is opened.
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  // Defense-in-depth against the focus effect above — see
  // src/services/data-sync.ts.
  const dataVersion = useDataSync(s => s.version);
  const isFirstVersion = React.useRef(true);
  React.useEffect(() => {
    if (isFirstVersion.current) { isFirstVersion.current = false; return; }
    load();
  }, [dataVersion, load]);

  const loadMoreEvents = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await insightsApi.getBehaviorEventsPaginated(next, 20);
      setEvents(prev => [...prev, ...(res?.events ?? [])]);
      setPage(next);
      setHasMore(next < (res?.pagination?.totalPages ?? 1));
    } catch (e) {
      console.error('Insights loadMore error:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const displayEvents = events.map(event => mapBehaviorEvent(event, colors)).filter((e): e is NonNullable<typeof e> => e != null);

  const filteredEvents = displayEvents.filter(event =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (event.desc && event.desc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getCategoryColor = (category: string): string => {
    const normalizedCategory = category.toLowerCase();
    if (categoryColors[normalizedCategory]) {
      return categoryColors[normalizedCategory];
    }
    return categoryColors.other || '#6B7280';
  };

  const metrics: (Metric & { kind: string })[] = [
    {
      kind: 'reallocation_frequency',
      label: 'Pocket moves',
      value: String(reallocationsThisMonth),
      story:
        reallocationsThisMonth === 0
          ? 'Money stayed in its job this month.'
          : reallocationsThisMonth === 1
            ? 'One deliberate move between pockets.'
            : `${reallocationsThisMonth} times you reassigned money's job.`,
      icon: ArrowLeftRight,
      color: colors.plum,
    },
    {
      kind: 'cooling_off_skips',
      label: 'Cooling-off skips',
      value: String(coolingOffSkips),
      story:
        coolingOffSkips === 0
          ? 'You let every pause finish — strong purpose habit.'
          : coolingOffSkips === 1
            ? 'One move skipped the pause this month.'
            : `${coolingOffSkips} moves skipped the pause — worth noticing.`,
      icon: Timer,
      color: colors.clay,
    },
  ];
  // Money-personality modifier layer (§2.3) — reorders these cards by the
  // priority order the API returned (insightPriorityOrderFor), without
  // changing which cards exist. Falls back to the order above when the API
  // didn't send one (older server build). Discipline score is the hero only.
  const orderedMetrics = cardOrder.length
    ? [...metrics].sort((a, b) => {
        const ai = cardOrder.indexOf(a.kind);
        const bi = cardOrder.indexOf(b.kind);
        return (ai === -1 ? cardOrder.length : ai) - (bi === -1 ? cardOrder.length : bi);
      })
    : metrics;

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading insights..." variant="insights" />
      </ScreenContainer>
    );
  }

  if (loadError) {
    return (
      <ScreenContainer>
        <ErrorState message={loadError} onRetry={load} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={{ ...typography.title, color: colors.ink, marginTop: spacing.sm }}>Insights</Text>

        {/* Segment Switcher (Phase 6) */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          <Pressable
            onPress={() => setSegment('individual')}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: segment === 'individual' ? colors.emeraldDeep : colors.surface,
              borderWidth: 1,
              borderColor: segment === 'individual' ? colors.emeraldDeep : colors.line,
            }}
          >
            <Text style={{ ...typography.caption, color: segment === 'individual' ? colors.surface : colors.ink, textAlign: 'center' }}>
              Personal
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSegment('msme')}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: segment === 'msme' ? colors.gold : colors.surface,
              borderWidth: 1,
              borderColor: segment === 'msme' ? colors.gold : colors.line,
            }}
          >
            <Text style={{ ...typography.caption, color: segment === 'msme' ? colors.surface : colors.ink, textAlign: 'center' }}>
              Business
            </Text>
          </Pressable>
        </View>

        {/* MSME Operational Insights — 020 invoices + 017 projects (real aggregates) */}
        {segment === 'msme' && (
          <View style={{ marginTop: spacing.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg }}>
              <Briefcase size={15} color={colors.ink} strokeWidth={2} />
              <Text style={{ ...typography.eyebrow, color: colors.ink }}>Business Health — Operational</Text>
            </View>
            {msmeLoading ? (
              <InlineLoading />
            ) : !msmeOperational && !msmeInsights ? (
              <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
                <Briefcase size={32} color={colors.sage} strokeWidth={2} />
                <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center', marginTop: spacing.md }}>No business data yet</Text>
                <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center', marginTop: spacing.xs, lineHeight: 16 }}>Create an invoice or project to see receivables & funding health.</Text>
              </View>
            ) : (
              <View style={{ gap: spacing.lg }}>
                {/* Alerts */}
                {msmeOperational?.alerts?.length > 0 && (
                  <View style={{ gap: spacing.sm }}>
                    {msmeOperational.alerts.map((a: any, i: number) => (
                      <View key={i} style={{ backgroundColor: a.severity === 'critical' ? colors.clayTint : a.severity === 'warn' ? colors.goldTint : colors.emeraldTint, borderRadius: radius.sm, padding: spacing.md, borderWidth: 1, borderColor: a.severity === 'critical' ? colors.clay : a.severity === 'warn' ? colors.gold : colors.line }}>
                        <Text style={{ ...typography.caption, color: a.severity === 'critical' ? colors.clay : a.severity === 'warn' ? colors.ink : colors.emeraldDeep, lineHeight: 16 }}>{a.message}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {/* Invoices — Receivables */}
                {msmeOperational?.invoices && (
                  <View style={{ backgroundColor: colors.paper, borderRadius: radius.sm, padding: spacing.md }}>
                    <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.md }}>Receivables — Invoices</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
                      <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.md }}>
                        <Text style={{ ...typography.caption, color: colors.sage }}>Outstanding</Text>
                        <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 }}>{formatMoney(msmeOperational.invoices.outstanding)}</Text>
                        <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 2 }}>{msmeOperational.invoices.total - msmeOperational.invoices.paid - msmeOperational.invoices.voidCount} open · {msmeOperational.invoices.overdue} overdue</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: msmeOperational.invoices.overdue > 0 ? colors.clayTint : colors.surface, borderWidth: 1, borderColor: msmeOperational.invoices.overdue > 0 ? colors.clay : colors.line, borderRadius: radius.sm, padding: spacing.md }}>
                        <Text style={{ ...typography.caption, color: msmeOperational.invoices.overdue > 0 ? colors.clay : colors.sage }}>Overdue</Text>
                        <Text style={{ ...typography.heading, color: msmeOperational.invoices.overdue > 0 ? colors.clay : colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 }}>{formatMoney(msmeOperational.invoices.overdueAmount)}</Text>
                        <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 2 }}>paid {formatMoney(msmeOperational.invoices.paidAmount)} · {msmeOperational.invoices.collectionRate}% collected</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                      <Text style={{ ...typography.caption, color: colors.sage }}>Collection rate</Text>
                      <Text style={{ ...typography.caption, color: msmeOperational.invoices.collectionRate >= 70 ? colors.emeraldDeep : msmeOperational.invoices.collectionRate >= 40 ? colors.gold : colors.clay, fontWeight: '700' }}>{msmeOperational.invoices.collectionRate}%</Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${msmeOperational.invoices.collectionRate}%`, backgroundColor: msmeOperational.invoices.collectionRate >= 70 ? colors.emeraldDeep : msmeOperational.invoices.collectionRate >= 40 ? colors.gold : colors.clay, borderRadius: radius.pill }} />
                    </View>
                  </View>
                )}
                {/* Projects — Funding */}
                {msmeOperational?.projects && (
                  <View style={{ backgroundColor: colors.paper, borderRadius: radius.sm, padding: spacing.md }}>
                    <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.md }}>Projects — Funding</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
                      <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.md }}>
                        <Text style={{ ...typography.caption, color: colors.sage }}>Contracts</Text>
                        <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 }}>{formatMoney(msmeOperational.projects.totalContractValue)}</Text>
                        <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 2 }}>{msmeOperational.projects.total} total · {msmeOperational.projects.active} active</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.md }}>
                        <Text style={{ ...typography.caption, color: colors.sage }}>Funded</Text>
                        <Text style={{ ...typography.heading, color: colors.emeraldDeep, fontVariant: ['tabular-nums'], marginTop: 2 }}>{msmeOperational.projects.fundingPercent}%</Text>
                        <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 2 }}>{formatMoney(msmeOperational.projects.totalAllocated)} / {formatMoney(msmeOperational.projects.totalContractValue)}</Text>
                      </View>
                    </View>
                    {msmeOperational.fundingVelocityDays != null && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ ...typography.caption, color: colors.sage }}>Avg funding velocity</Text>
                        <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{msmeOperational.fundingVelocityDays}d</Text>
                      </View>
                    )}
                  </View>
                )}
                {/* Legacy fallback — show old Phase 6 card if operational missing but legacy present */}
                {!msmeOperational && msmeInsights && (
                  <View style={{ backgroundColor: colors.paper, borderRadius: radius.sm, padding: spacing.md }}>
                    <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.md }}>Legacy Phase 6</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.md }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}><Target size={14} color={colors.ink} strokeWidth={2} /><Text style={{ ...typography.caption, color: colors.sage }}>Total Projects</Text></View>
                        <Text style={{ ...typography.display, color: colors.ink, fontSize: 24 }}>{msmeInsights.totalProjects}</Text>
                        <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>{msmeInsights.activeProjects} active • {msmeInsights.completedProjects} completed</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.md }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}><Clock size={14} color={colors.ink} strokeWidth={2} /><Text style={{ ...typography.caption, color: colors.sage }}>Avg Funding Speed</Text></View>
                        <Text style={{ ...typography.display, color: colors.ink, fontSize: 24 }}>{msmeInsights.avgFundingVelocity}d</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Personal Insights - Only show when segment is individual */}
        {segment === 'individual' && (
          <View style={{ marginTop: spacing.xl, borderRadius: radius.lg, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, backgroundColor: colors.emeraldDeep, alignItems: 'center' }}>
          {/* Gate on hasScoreHistory (not score === null) so a backend regression
              that returns a non-null default score can't resurrect the fake-100 display.
              hasScoreHistory is an independent signal from the API that the user has
              at least one real discipline_scores row — score alone is not sufficient. */}
          {!hasScoreHistory ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ ...typography.body, color: colors.surface, textAlign: 'center', marginBottom: spacing.md }}>
                Start tracking to see your spending discipline
              </Text>
              <Text style={{ ...typography.caption, color: `${colors.surface}80`, textAlign: 'center' }}>
                Your discipline score will appear after your first spending activity
              </Text>
            </View>
          ) : (
            <>
              <View style={{ marginTop: spacing.md }}>
                <ProgressRing
                  progress={score ?? 0}
                  size={120}
                  strokeWidth={8}
                  color={colors.surface}
                  trackColor={`${colors.surface}55`}
                >
                  <Text style={{ ...typography.display, color: colors.surface, fontSize: 36 }}>{score ?? 0}</Text>
                </ProgressRing>
              </View>
              <Text style={{ ...typography.caption, color: `${colors.surface}99`, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xs }}>
                {scoreBandLabel(score ?? 0)}
              </Text>
              {scorePeriod && (
                <Text style={{ ...typography.caption, color: `${colors.surface}80`, marginTop: spacing.xs }}>
                  {scorePeriod}
                </Text>
              )}
              <Text style={{ ...typography.caption, color: `${colors.surface}CC`, marginTop: spacing.sm, textAlign: 'center', lineHeight: 18 }}>
                {disciplineMomentumCopy(delta, score ?? 0)}
              </Text>
              {(score ?? 0) <= 25 && (
                <View
                  style={{
                    marginTop: spacing.lg,
                    width: '100%',
                    backgroundColor: `${colors.surface}18`,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: `${colors.surface}33`,
                  }}
                >
                  <Text style={{ ...typography.heading, color: colors.surface, marginBottom: spacing.xs }}>
                    A tough stretch — not a dead end
                  </Text>
                  <Text style={{ ...typography.caption, color: `${colors.surface}CC`, lineHeight: 16, marginBottom: spacing.md }}>
                    Your score floors at 0 so it never goes “more broken.” Small wins rebuild it: stay under today’s caps, let cooling-off finish, keep savings locked.
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <Pressable
                      onPress={() => router.push('/(tabs)/')}
                      style={{
                        backgroundColor: colors.surface,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.pill,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Review today’s safe-to-spend"
                    >
                      <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                        Review today
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push('/(security)/time-lock')}
                      style={{
                        backgroundColor: 'transparent',
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        borderColor: `${colors.surface}66`,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Check savings lock"
                    >
                      <Text style={{ ...typography.caption, color: colors.surface }}>
                        Check savings lock
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
        )}

        {/* Personal Insights Section */}
        {segment === 'individual' && (
          <>
        {/* Purpose stories — discipline score lives in the hero only (no duplicate metric). */}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          {orderedMetrics.map((metric, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.md,
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.md,
                alignItems: 'center',
              }}
              accessibilityLabel={`${metric.label}: ${metric.value}. ${metric.story}`}
            >
              <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: `${metric.color}1A`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                <metric.icon size={16} color={metric.color} strokeWidth={2} />
              </View>
              <Text style={{ ...typography.heading, fontSize: 20, color: colors.ink, textAlign: 'center' }}>{metric.value}</Text>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs, lineHeight: 14, textAlign: 'center' }}>{metric.label}</Text>
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage, marginTop: spacing.xs, lineHeight: 13, textAlign: 'center' }}>{metric.story}</Text>
            </View>
          ))}
        </View>

        {/* Spending consistency heatmap — day-by-day spending behavior from the backend
            (see /insights/activity-heatmap), showing under-cap spending patterns. */}
        <View style={{ marginTop: spacing.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg }}>
            <CalendarCheck size={15} color={colors.ink} strokeWidth={2} />
            <Text style={{ ...typography.eyebrow, color: colors.ink }}>Spending consistency</Text>
          </View>
          <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.md, lineHeight: 16 }}>
            Day-by-day behavior over a rolling window — pair with your calendar-month score above.
          </Text>
          <StreakHeatmap />
        </View>

        {/* Budget Comparison Dashboard */}
        <View style={{ marginTop: spacing.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg }}>
            <PieChart size={15} color={colors.ink} strokeWidth={2} />
            <Text style={{ ...typography.eyebrow, color: colors.ink }}>Budget vs. Actual</Text>
          </View>
          <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.md, lineHeight: 16 }}>
            See how your spending compares to your monthly allocations by category.
          </Text>
          
          {budgetComparison.length === 0 ? (
            <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
              <PieChart size={32} color={colors.sage} strokeWidth={2} />
              <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center', marginTop: spacing.md }}>
                No budget data available yet
              </Text>
              <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center', marginTop: spacing.xs, lineHeight: 16 }}>
                Start by creating spendable pockets with monthly allocations to track your budget progress
              </Text>
            </View>
          ) : (
            budgetComparison.map((item) => (
              <View key={item.id} style={{ marginBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                  <Text style={{ ...typography.heading, color: colors.ink }}>{item.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    {item.isOverBudget ? (
                      <TrendingUp size={14} color={colors.clay} strokeWidth={2} />
                    ) : (
                      <TrendingDown size={14} color={colors.emeraldDeep} strokeWidth={2} />
                    )}
                    <Text style={{ ...typography.caption, color: item.isOverBudget ? colors.clay : colors.emeraldDeep, fontVariant: ['tabular-nums'] }}>
                      {item.percentage.toFixed(0)}%
                    </Text>
                  </View>
                </View>
                
                {/* Progress bar */}
                <View style={{ height: 8, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden', marginBottom: spacing.xs }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${item.percentage}%`,
                      backgroundColor: item.isOverBudget ? colors.clay : colors.emeraldDeep,
                      borderRadius: radius.pill,
                    }}
                  />
                </View>
                
                {/* Amount breakdown */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ ...typography.caption, color: colors.sage }}>
                    Spent: {formatMoney(item.spent)}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.sage, fontVariant: ['tabular-nums'] }}>
                    Budget: {formatMoney(item.monthlyAllocation)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Spending Trends Analytics */}
        <View style={{ marginTop: spacing.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg }}>
            <TrendingUp size={15} color={colors.ink} strokeWidth={2} />
            <Text style={{ ...typography.eyebrow, color: colors.ink }}>Spending trends</Text>
          </View>
          <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.md, lineHeight: 16 }}>
            Track your spending patterns over different time periods.
          </Text>
          
          {/* Period selector */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            {(['7', '30', '90'] as const).map((period) => (
              <Pressable
                key={period}
                onPress={() => setSelectedTrendPeriod(period)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.sm,
                  backgroundColor: selectedTrendPeriod === period ? colors.emeraldDeep : colors.surface,
                  borderWidth: 1,
                  borderColor: selectedTrendPeriod === period ? colors.emeraldDeep : colors.line,
                }}
              >
                <Text
                  style={{
                    ...typography.caption,
                    color: selectedTrendPeriod === period ? colors.surface : colors.ink,
                    textAlign: 'center',
                    textTransform: 'capitalize',
                  }}
                >
                  {period} days
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Total spending */}
          {trendData && (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>
                Total spending
              </Text>
              <Text style={{ ...typography.display, color: colors.ink, fontSize: 36 }}>
                {formatMoney(trendData.total)}
              </Text>
            </View>
          )}

          {/* Category breakdown bars */}
          {trendData && trendData.breakdown.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              {trendData.breakdown.slice(0, 5).map((item, index) => {
                const barWidth = Math.max(5, item.percentage);
                const categoryColor = getCategoryColor(item.category);
                return (
                  <View key={item.category}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: categoryColor }} />
                        <Text style={{ ...typography.heading, color: colors.ink, fontSize: 15 }}>
                          {item.category}
                        </Text>
                      </View>
                      <Text style={{ ...typography.caption, color: colors.sage, fontVariant: ['tabular-nums'] }}>
                        {item.percentage.toFixed(0)}%
                      </Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden' }}>
                      <View
                        style={{
                          height: '100%',
                          width: `${barWidth}%`,
                          backgroundColor: categoryColor,
                          borderRadius: radius.pill,
                        }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
                      <Text style={{ ...typography.caption, color: colors.sage }}>
                        {formatMoney(item.amount)}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {trendData.breakdown.length > 5 && (
                <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center', marginTop: spacing.xs }}>
                  +{trendData.breakdown.length - 5} more categories
                </Text>
              )}
            </View>
          ) : (
            <View style={{ paddingVertical: spacing.xl, alignItems: 'center', backgroundColor: colors.paper, borderRadius: radius.sm, padding: spacing.lg }}>
              <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center' }}>
                No spending data for this period
              </Text>
              <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center', marginTop: spacing.xs }}>
                Your spending trends will appear here once you start tracking expenses
              </Text>
            </View>
          )}
        </View>

        {segment === 'individual' && (
          <>
        <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Spending behavior insights</Text>

        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search spending patterns..."
          onClear={() => setSearchQuery('')}
        />

        {/* Load More previously lived only inside the "has events" branch
            below, so it silently disappeared whenever the current page's
            events were all filtered out — either by an active search
            matching nothing on this page, or by mapBehaviorEvent returning
            null for every event on this page (e.g. a page made up entirely
            of zero-amount daily_rollover_success events, which are
            intentionally hidden). hasMore reflects real backend pagination
            state independent of what's renderable right now, so it's
            checked and rendered outside/after the branch below instead —
            the user can always reach further pages as long as more exist,
            even when nothing on the current page happens to be visible. */}
        {filteredEvents.length === 0 && displayEvents.length > 0 ? (
          <EmptyState
            variant="no-results"
            title="No activity matches your search"
            description="Try adjusting your search terms or filters"
            actionLabel="Clear search"
            onAction={() => setSearchQuery('')}
          />
        ) : displayEvents.length === 0 && !hasMore ? (
          <EmptyState
            variant="empty"
            title="No spending activity yet"
            description="Start tracking your spending to see insights and patterns"
          />
        ) : (
          filteredEvents.map((event, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: event.color }} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.heading, color: colors.ink }}>{event.title}</Text>
                {event.desc ? <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, lineHeight: 16 }}>{event.desc}</Text> : null}
              </View>
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage, marginLeft: 'auto' }}>{event.time}</Text>
            </View>
          ))
        )}
        {hasMore && (
          loadingMore ? (
            <InlineLoading />
          ) : (
            <Pressable
              onPress={loadMoreEvents}
              style={{ paddingVertical: spacing.md, alignItems: 'center' }}
              accessibilityLabel="Load more activity"
              accessibilityRole="button"
            >
              <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                Load more
              </Text>
            </Pressable>
          )
        )}
        </>
        )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}