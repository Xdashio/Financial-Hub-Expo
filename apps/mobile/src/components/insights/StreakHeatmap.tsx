import React from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, radius } from '@/theme';
import { insightsApi } from '@/services/api';

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
// values. Zero-activity days render as a neutral empty cell; days with
// activity shade from light to dark by count, and get a red tint if net
// points went down that day (e.g. an early unlock) rather than up.
function cellColor(day: HeatmapDay, colors: any) {
  if (day.count === 0) return colors.lineSoft;
  if (day.points < 0) {
    // Negative day — shade of clay by severity.
    const intensity = Math.min(1, Math.abs(day.points) / 10);
    return intensity > 0.6 ? colors.clay : colors.clay + '99';
  }
  const intensity = Math.min(1, day.count / 4);
  if (intensity > 0.75) return colors.emeraldDeep;
  if (intensity > 0.4) return colors.emerald;
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

  const load = React.useCallback(async (r: Range) => {
    setIsLoading(true);
    try {
      const data = await insightsApi.getActivityHeatmap(r);
      setDays(data);
      setSelected(null);
    } catch (e) {
      console.error('StreakHeatmap load error:', e);
      setDays([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load(range);
  }, [range, load]);

  // Longest streak of consecutive days with at least one non-negative
  // (i.e. not a point-losing) event, computed from the same real data the
  // grid renders — this is the number the app should show instead of a
  // hardcoded "N days untouched" figure.
  const currentStreak = React.useMemo(() => {
    if (!days || days.length === 0) return 0;
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].points < 0) break;
      streak += 1;
    }
    return streak;
  }, [days]);

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
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>Based on your logged activity</Text>
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
                      onPress={() => setSelected(day)}
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

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage }}>Less</Text>
              {[colors.lineSoft, colors.emeraldTint, colors.emerald, colors.emeraldDeep].map((c, i) => (
                <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
              ))}
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage }}>More</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.clay }} />
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage }}>Points lost</Text>
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
            </View>
          )}
        </>
      )}
    </View>
  );
}