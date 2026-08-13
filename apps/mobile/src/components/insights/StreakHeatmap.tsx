import React from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, radius } from '@/theme';
import { insightsApi } from '@/services/api';
import { mapBehaviorEvent } from '@/utils/behaviorEvent';

type Range = 'week' | 'month' | 'year';

interface HeatmapDay {
  date: string; // 'YYYY-MM-DD'
  count: number;
  points: number;
}

const RANGE_LABELS: Record<Range, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

// Cell colour is driven entirely by real event counts/points returned by
// the backend (see /insights/activity-heatmap) — no placeholder or made-up
// values. Zero-activity days render as a neutral empty cell.
//
// Both branches key off `points`, not a mix of `count` and `points` — a
// day used to shade green by count/4 while a bad day shaded by
// abs(points)/10, so two axes that mean different things ("how many
// things happened" vs "how much it moved your score") were being drawn on
// the same scale. A day with one big win and a day with four small ones
// rendered identically, and there was no way to tell from color alone
// whether a day helped or barely mattered. Using points consistently
// means a cell's darkness always answers "how much did this day move the
// needle", with color (green vs clay) answering "which direction" and the
// per-day tooltip still surfacing the raw event count for "how many
// actions" detail that color alone can't carry.
const POSITIVE_POINTS_SCALE = 20; // points/day considered "fully saturated" green
const NEGATIVE_POINTS_SCALE = 15; // points/day considered "fully saturated" clay

function cellColor(day: HeatmapDay, colors: any) {
  if (day.count === 0) return colors.lineSoft;
  if (day.points < 0) {
    const intensity = Math.min(1, Math.abs(day.points) / NEGATIVE_POINTS_SCALE);
    if (intensity > 0.66) return colors.clay;
    if (intensity > 0.33) return colors.clay + 'CC';
    return colors.clay + '80';
  }
  // Positive but zero net points (e.g. neutral logging activity) still
  // gets the lightest green tint rather than looking identical to a
  // no-activity day — showing something happened, even if it didn't
  // move the score.
  const intensity = day.points === 0 ? 0 : Math.min(1, day.points / POSITIVE_POINTS_SCALE);
  if (intensity > 0.66) return colors.emeraldDeep;
  if (intensity > 0.33) return colors.emerald;
  return colors.emeraldTint;
}

function formatDayLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function StreakHeatmap() {
  const { colors } = useTheme();
  const [range, setRange] = React.useState<Range>('month');
  const [days, setDays] = React.useState<HeatmapDay[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<HeatmapDay | null>(null);
  const [selectedEvents, setSelectedEvents] = React.useState<any[] | null>(null);
  const [loadingSelected, setLoadingSelected] = React.useState(false);
  const [apiStreak, setApiStreak] = React.useState<number | null>(null);

  // Tapping a cell used to only be able to show the aggregate count/points
  // that day carried, because that's all getActivityHeatmap() ever
  // returned — there was no way to know what actually happened. This fetches
  // the real events for that calendar day from the new /day endpoint so the
  // panel can show what caused the movement, not just that it happened.
  const selectDay = async (day: HeatmapDay) => {
    setSelected(day);
    setSelectedEvents(null);
    if (day.count === 0) return;
    setLoadingSelected(true);
    try {
      const events = await insightsApi.getActivityHeatmapDay(day.date);
      setSelectedEvents(Array.isArray(events) ? events : []);
    } catch (e) {
      console.error('StreakHeatmap day-detail load error:', e);
      setSelectedEvents([]);
    } finally {
      setLoadingSelected(false);
    }
  };

  const load = React.useCallback(async (r: Range) => {
    setIsLoading(true);
    try {
      const [data, streak] = await Promise.all([
        insightsApi.getActivityHeatmap(r),
        insightsApi.getStreak().catch(() => null),
      ]);
      setDays(data);
      if (streak) setApiStreak(streak.currentStreak);
      setSelected(null);
      setSelectedEvents(null);
    } catch (e) {
      console.error('StreakHeatmap load error:', e);
      setDays([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (cancelled) return;
      await load(range);
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [range, load]);

  // Prefer the backend under-cap streak (rollover successes + grace/freeze).
  // Fall back to a heatmap-derived streak if the streak endpoint fails.
  const heatmapStreak = React.useMemo(() => {
    if (!days || days.length === 0) return 0;
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].points < 0) break;
      streak += 1;
    }
    return streak;
  }, [days]);
  const currentStreak = apiStreak ?? heatmapStreak;

  // Lay the days out into week columns (7 rows) so year/month views read
  // as a GitHub-style contribution grid rather than a single long strip.
  const weeks = React.useMemo(() => {
    if (!days) return [];
    const cols: HeatmapDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      cols.push(days.slice(i, i + 7));
    }
    return cols;
  }, [days]);

  const cellSize = range === 'year' ? 8 : range === 'month' ? 14 : 28;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View>
          <Text style={{ ...typography.heading, color: colors.ink }}>{currentStreak} day{currentStreak === 1 ? '' : 's'} active streak</Text>
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>Under-cap days (with grace)</Text>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: colors.paper, borderRadius: radius.pill, padding: 3 }}>
          {(['week', 'month', 'year'] as Range[]).map(r => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                backgroundColor: range === r ? colors.emeraldDeep : 'transparent',
              }}
            >
              <Text style={{ ...typography.caption, color: range === r ? colors.surface : colors.sage }}>
                {RANGE_LABELS[r]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.emeraldDeep} />
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {weeks.map((week, wi) => (
                <View key={wi} style={{ gap: 3 }}>
                  {week.map(day => (
                    <Pressable
                      key={day.date}
                      onPress={() => selectDay(day)}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        borderRadius: 3,
                        backgroundColor: cellColor(day, colors),
                        borderWidth: selected?.date === day.date ? 1.5 : 0,
                        borderColor: colors.ink,
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage, width: 60 }}>Points up</Text>
              {[colors.lineSoft, colors.emeraldTint, colors.emerald, colors.emeraldDeep].map((c, i) => (
                <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
              ))}
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage, marginLeft: 2 }}>more</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage, width: 60 }}>Points down</Text>
              {[colors.lineSoft, colors.clay + '80', colors.clay + 'CC', colors.clay].map((c, i) => (
                <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
              ))}
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage, marginLeft: 2 }}>more</Text>
            </View>
          </View>

          {selected && (
            <View style={{ marginTop: spacing.md, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.paper }}>
              <Text style={{ ...typography.heading, color: colors.ink, fontSize: 13 }}>{formatDayLabel(selected.date)}</Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                {selected.count === 0
                  ? 'No activity'
                  : `${selected.count} event${selected.count === 1 ? '' : 's'}${selected.points !== 0 ? ` · ${selected.points > 0 ? '+' : ''}${selected.points} pts` : ''}`}
              </Text>

              {selected.count > 0 && (
                loadingSelected ? (
                  <View style={{ paddingVertical: spacing.sm }}>
                    <ActivityIndicator size="small" color={colors.emeraldDeep} />
                  </View>
                ) : (
                  <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                    {(selectedEvents ?? []).map((event, i) => {
                      const display = mapBehaviorEvent(event, colors);
                      return (
                        <View key={event.id ?? i} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 5, backgroundColor: display.color }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ ...typography.caption, color: colors.ink, fontWeight: '600' }}>{display.title}</Text>
                            {display.desc ? (
                              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: 1 }}>{display.desc}</Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}