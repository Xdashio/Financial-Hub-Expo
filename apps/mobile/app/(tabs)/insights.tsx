import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { CalendarCheck, ArrowLeftRight, Target, Timer } from 'lucide-react-native';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { insightsApi, reallocationsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { LoadingState, ErrorState, InlineLoading, SearchBar, EmptyState } from '@/components/ui';
import { StreakHeatmap } from '@/components/insights/StreakHeatmap';
import { mapBehaviorEvent } from '@/utils/behaviorEvent';

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

interface Metric {
  label: string;
  value: string;
  icon: any;
  color: string;
}

export default function InsightsScreen() {
  const { colors } = useTheme();

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

  const load = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [scoreRes, eventsRes, reallocRes] = await Promise.all([
        insightsApi.getDisciplineScore(),
        insightsApi.getBehaviorEventsPaginated(1, 20),
        reallocationsApi.getAll().catch(() => []),
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
    } catch (e) {
      console.error('Insights load error:', e);
      setLoadError('Failed to load your insights. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Discipline score and reallocation counts change from other screens
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

  const metrics: (Metric & { kind: string })[] = [
    { kind: 'reallocation_frequency', label: 'Pocket adjustments this month', value: String(reallocationsThisMonth), icon: ArrowLeftRight, color: colors.plum },
    { kind: 'discipline_score', label: 'Spending discipline', value: score !== null ? `${score}%` : '—', icon: Target, color: colors.gold },
    { kind: 'cooling_off_skips', label: 'Cooling-off skips', value: String(coolingOffSkips), icon: Timer, color: colors.clay },
  ];
  // Money-personality modifier layer (§2.3) — reorders these cards by the
  // priority order the API returned (insightPriorityOrderFor), without
  // changing which cards exist. Falls back to the order above when the API
  // didn't send one (older server build).
  const orderedMetrics = cardOrder.length
    ? [...metrics].sort((a, b) => {
        const ai = cardOrder.indexOf(a.kind);
        const bi = cardOrder.indexOf(b.kind);
        return (ai === -1 ? cardOrder.length : ai) - (bi === -1 ? cardOrder.length : bi);
      })
    : metrics;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <LoadingState label="Loading insights…" />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <ErrorState message={loadError} onRetry={load} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={{ ...typography.title, color: colors.ink, marginTop: spacing.xl }}>Insights</Text>

        <View style={{ marginTop: spacing.xl, borderRadius: radius.lg, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, backgroundColor: colors.emeraldDeep, alignItems: 'center' }}>
          {score === null ? (
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
              <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 8, borderColor: `${colors.surface}33`, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md }}>
                <Text style={{ ...typography.display, color: colors.surface, fontSize: 36 }}>{score}</Text>
              </View>
              <Text style={{ ...typography.caption, color: `${colors.surface}99`, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xs }}>Spending discipline</Text>
              {scorePeriod && (
                <Text style={{ ...typography.caption, color: `${colors.surface}80`, marginTop: spacing.xs }}>
                  {scorePeriod}
                </Text>
              )}
              <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: `${colors.surface}1E`, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
                <Text style={{ ...typography.caption, color: colors.surface }}>
                  {delta > 0 ? `+${delta}` : delta} pts this period
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Metrics — previously a fixed row of hardcoded numbers with a
            plain "●" glyph standing in for an icon, and inconsistent
            internal spacing. Now real data, real icons, and a centered
            layout so the value/label pair lines up the same way across all
            three cards regardless of label length. */}
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
            >
              <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: `${metric.color}1A`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                <metric.icon size={16} color={metric.color} strokeWidth={2} />
              </View>
              <Text style={{ ...typography.heading, fontSize: 20, color: colors.ink, textAlign: 'center' }}>{metric.value}</Text>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs, lineHeight: 14, textAlign: 'center' }}>{metric.label}</Text>
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
          <StreakHeatmap />
        </View>

        <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Spending behavior insights</Text>

        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search spending patterns..."
          onClear={() => setSearchQuery('')}
        />

        {filteredEvents.length === 0 && displayEvents.length > 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No activity matches your search"
            description="Try adjusting your search terms or filters"
            actionLabel="Clear search"
            onAction={() => setSearchQuery('')}
          />
        ) : displayEvents.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No spending activity yet"
            description="Start tracking your spending to see insights and patterns"
          />
        ) : (
          <>
            {filteredEvents.map((event, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: event.color }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.heading, color: colors.ink }}>{event.title}</Text>
                  {event.desc ? <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, lineHeight: 16 }}>{event.desc}</Text> : null}
                </View>
                <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage, marginLeft: 'auto' }}>{event.time}</Text>
              </View>
            ))}
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
      </ScrollView>
    </SafeAreaView>
  );
}