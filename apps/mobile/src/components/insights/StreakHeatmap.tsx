import React from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Animated, Easing, Dimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, radius } from '@/theme';
import { insightsApi } from '@/services/api';
import { mapBehaviorEvent } from '@/utils/behaviorEvent';
import { TrendingUp, Award, Sparkles, Calendar, X } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui';

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

// Cell colour is driven entirely by real spending behavior returned by
// the backend (see /insights/activity-heatmap) — showing under-cap spending
// patterns. Zero-activity days render as a neutral empty cell.
//
// Both branches key off `points`, not a mix of `count` and `points` — a
// day used to shade green by count/4 while a bad day shaded by
// abs(points)/10, so two axes that mean different things ("how many
// spending decisions" vs "how much it moved your consistency score") were
// being drawn on the same scale. A day with one big win and a day with four
// small ones rendered identically, and there was no way to tell from color alone
// whether a day helped or barely mattered. Using points consistently
// means a cell's darkness always answers "how much did this day improve your
spending consistency", with color (green vs clay) answering "which direction" and the
// per-day tooltip still surfacing the raw spending decision count for "how many
// decisions" detail that color alone can't carry.
const POSITIVE_POINTS_SCALE = 20; // points/day considered "fully saturated" green
const NEGATIVE_POINTS_SCALE = 15; // points/day considered "fully saturated" clay

function cellColor(day: HeatmapDay, colors: any) {
  if (day.count === 0) return colors.lineSoft;
  if (day.points < 0) {
    const intensity = Math.min(1, Math.abs(day.points) / NEGATIVE_POINTS_SCALE);
    if (intensity > 0.66) return colors.clay;
    if (intensity > 0.33) return colors.clay + 'DD';
    return colors.clay + 'AA';
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
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [streakMilestone, setStreakMilestone] = React.useState<number | null>(null);
  const [showDayDetail, setShowDayDetail] = React.useState(false);
  
  const scaleAnim = React.useRef(new Animated.Value(0));
  const fadeAnim = React.useRef(new Animated.Value(0));
  const pulseAnim = React.useRef(new Animated.Value(1));

  const { width: screenWidth } = Dimensions.get('window');
  const isSmallScreen = screenWidth < 375;

  // Tapping a cell used to only be able to show the aggregate count/points
  // that day carried, because that's all getActivityHeatmap() ever
  // returned — there was no way to know what actually happened. This fetches
  // the real spending decisions for that calendar day from the new /day endpoint so the
  // panel can show what caused the consistency change, not just that it happened.
  const selectDay = async (day: HeatmapDay) => {
    setSelected(day);
    setSelectedEvents(null);
    setShowDayDetail(true);
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

  // Prefer the backend under-cap consistency (rollover successes + grace/freeze).
  // Fall back to a heatmap-derived consistency if the consistency endpoint fails.
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

  // Detect streak milestones for celebration
  React.useEffect(() => {
    if (currentStreak > 0) {
      const milestones = [7, 30, 100, 365];
      if (milestones.includes(currentStreak) && currentStreak !== streakMilestone) {
        setStreakMilestone(currentStreak);
        setShowCelebration(true);
        
        // Subtle celebration animation
        Animated.sequence([
          Animated.timing(scaleAnim.current, {
            toValue: 1.05,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim.current, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();

        // Hide celebration after 2 seconds (shorter for subtlety)
        setTimeout(() => setShowCelebration(false), 2000);
      }
    }
  }, [currentStreak, streakMilestone]);

  // Pulsing animation for streak counter
  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim.current, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim.current, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    return () => pulse.stop();
  }, []);

  // Get encouraging message based on streak - focused on financial behavior and outcomes
  const getStreakMessage = (streak: number): string => {
    if (streak === 0) return "Start tracking your spending habits today";
    if (streak < 3) return "Great start! Consistent spending habits build financial resilience";
    if (streak < 7) return "You're building healthy spending patterns";
    if (streak < 14) return "Consistent habits strengthen your financial foundation";
    if (streak < 30) return "Your spending discipline is improving your financial health";
    if (streak < 60) return "Strong habits are protecting your financial goals";
    if (streak < 100) return "Your consistent behavior is building lasting financial stability";
    if (streak < 365) return "A year of disciplined spending behavior - remarkable achievement";
    return "Long-term spending discipline is the foundation of financial success";
  };

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

  // Responsive cell sizing
  const getCellSize = () => {
    if (range === 'year') return isSmallScreen ? 6 : 8;
    if (range === 'month') return isSmallScreen ? 12 : 14;
    return isSmallScreen ? 24 : 28;
  };

  const getCellGap = () => {
    if (range === 'year') return 2;
    if (range === 'month') return 3;
    return 4;
  };

  const cellSize = getCellSize();
  const cellGap = getCellGap();

  return (
    <View>
      {/* Compact spending consistency header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Animated.View style={{ transform: [{ scale: pulseAnim.current }] }}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: spacing.xs,
              backgroundColor: currentStreak > 0 ? colors.emeraldTint : colors.lineSoft,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: currentStreak > 0 ? colors.emeraldDeep : colors.line,
            }}>
              {currentStreak > 0 ? (
                <TrendingUp size={16} color={colors.emeraldDeep} strokeWidth={2} />
              ) : (
                <Calendar size={16} color={colors.sage} strokeWidth={2} />
              )}
              <Text style={{ ...typography.heading, color: colors.ink, fontSize: 20 }}>
                {currentStreak}
              </Text>
              {currentStreak >= 30 && (
                <Award size={14} color={colors.gold} strokeWidth={2} />
              )}
            </View>
          </Animated.View>
          {showCelebration && (
            <Animated.View style={{ transform: [{ scale: scaleAnim.current }] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Sparkles size={14} color={colors.gold} strokeWidth={2} />
                <Text style={{ ...typography.caption, color: colors.gold, fontSize: 12 }}>
                  {streakMilestone} day{streakMilestone === 1 ? '' : 's'} milestone
                </Text>
              </View>
            </Animated.View>
          )}
        </View>
        
        <View style={{ flexDirection: 'row', backgroundColor: colors.paper, borderRadius: radius.pill, padding: 2 }}>
          {(['week', 'month', 'year'] as Range[]).map(r => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={{
                paddingVertical: 4,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: range === r ? colors.emeraldDeep : 'transparent',
              }}
              accessibilityLabel={`Show ${RANGE_LABELS[r]} view`}
              accessibilityRole="button"
            >
              <Text style={{ ...typography.caption, color: range === r ? colors.surface : colors.sage, fontSize: 11 }}>
                {RANGE_LABELS[r]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, marginBottom: spacing.sm }}>
        {getStreakMessage(currentStreak)}
      </Text>

      {isLoading ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.emeraldDeep} />
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: cellGap }}>
              {weeks.map((week, wi) => (
                <View key={wi} style={{ gap: cellGap }}>
                  {week.map(day => (
                    <Pressable
                      key={day.date}
                      onPress={() => selectDay(day)}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        borderRadius: 2,
                        backgroundColor: cellColor(day, colors),
                        borderWidth: selected?.date === day.date ? 2 : 0,
                        borderColor: colors.ink,
                      }}
                      accessibilityLabel={`${formatDayLabel(day.date)}: ${day.count} spending decision${day.count === 1 ? '' : 's'}, ${day.points !== 0 ? `${day.points > 0 ? '+' : ''}${day.points} points` : 'no points'}`}
                      accessibilityRole="button"
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Compact legend */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage }}>Low impact</Text>
              {[colors.lineSoft, colors.emeraldTint, colors.emerald, colors.emeraldDeep].map((c, i) => (
                <View key={i} style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c }} />
              ))}
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage }}>High impact</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.md }}>
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage }}>Negative</Text>
              {[colors.lineSoft, colors.clay + '80', colors.clay + 'CC', colors.clay].map((c, i) => (
                <View key={i} style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c }} />
              ))}
            </View>
          </View>

          {/* Bottom sheet for day detail */}
          <BottomSheetModal
            visible={showDayDetail}
            onClose={() => setShowDayDetail(false)}
            title={selected ? formatDayLabel(selected.date) : 'Day Details'}
          >
            {selected && (
              <View>
                <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.md }}>
                  {selected.count === 0
                    ? 'No spending decisions'
                    : `${selected.count} spending decision${selected.count === 1 ? '' : 's'}${selected.points !== 0 ? ` · ${selected.points > 0 ? '+' : ''}${selected.points} points` : ''}`}
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
                          <View key={event.id ?? i} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
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
          </BottomSheetModal>
        </>
      )}
    </View>
  );
}