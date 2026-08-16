import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarCheck, ArrowLeftRight, Timer } from 'lucide-react-native';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { insightsApi, reallocationsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { ScreenContainer, LoadingState, ErrorState, InlineLoading, SearchBar, EmptyState, ProgressRing } from '@/components/ui';
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
        <LoadingState label="Loading insights…" />
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

        <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>Spending behavior insights</Text>

        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search spending patterns..."
          onClear={() => setSearchQuery('')}
        />

        {filteredEvents.length === 0 && displayEvents.length > 0 ? (
          <EmptyState
            variant="no-results"
            title="No activity matches your search"
            description="Try adjusting your search terms or filters"
            actionLabel="Clear search"
            onAction={() => setSearchQuery('')}
          />
        ) : displayEvents.length === 0 ? (
          <EmptyState
            variant="empty"
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
    </ScreenContainer>
  );
}